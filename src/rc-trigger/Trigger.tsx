import createElement from 'inferno-create-element';
import Component from 'inferno-component';
import {observer} from 'inferno-mobx';
import {Children, cloneElement, findDOMNode, unstable_renderSubtreeIntoContainer} from 'inferno-compat';
import contains from '../rc-util/Dom/contains';
import addEventListener from '../rc-util/Dom/addEventListener';
import Popup from './Popup';
import {getAlignFromPlacement, getPopupClassNameFromAlign} from './utils';
import {defaultGetContainer} from '../rc-util/getContainerRenderMixin';
import noop from "../rc-util/noop";
import {ITrigger} from "./PropsType";

function returnEmptyString() {
    return '';
}

function returnDocument() {
    return window.document;
}

// use fastclick for mobile touch
const ALL_HANDLERS = ['onClick', 'onMouseDown', 'onMouseEnter',
    'onMouseLeave', 'onFocus', 'onBlur'];

const config: any = {
    autoMount: false,

    isVisible(instance) {
        return instance.state.popupVisible;
    },

    getContainer(instance) {
        const {props} = instance;
        const popupContainer = document.createElement('div');
        // Make sure default popup container will never cause scrollbar appearing
        // https://github.com/react-component/trigger/issues/41
        popupContainer.style.position = 'absolute';
        popupContainer.style.top = '0';
        popupContainer.style.left = '0';
        popupContainer.style.width = '100%';
        const mountNode = props.getPopupContainer ?
            props.getPopupContainer(findDOMNode(instance)) : props.getDocument().body;
        mountNode.appendChild(popupContainer);
        return popupContainer;
    },
};

const {
    autoMount = true,
    autoDestroy = true,
    isVisible,
    getComponent,
    getContainer = defaultGetContainer,
} = config;

function renderComponent(instance, componentArg?, ready?) {
    if (!isVisible || instance._component || isVisible(instance)) {
        if (!instance._container) {
            instance._container = getContainer(instance);
        }
        let component;
        if (instance.getComponent) {
            component = instance.getComponent(componentArg);
        } else {
            component = getComponent(instance, componentArg);
        }
        unstable_renderSubtreeIntoContainer(instance,
            component, instance._container,
            function callback() {
                instance._component = this;
                if (ready) {
                    ready.call(this);
                }
            });
    }
}

@observer
export default class Trigger extends Component<ITrigger, any> {

    static defaultProps = {
        prefixCls: 'rc-trigger-popup',
        getPopupClassNameFromAlign: returnEmptyString,
        getDocument: returnDocument,
        onPopupVisibleChange: noop,
        afterPopupVisibleChange: noop,
        onPopupAlign: noop,
        popupClassName: '',
        mouseEnterDelay: 0,
        mouseLeaveDelay: 0.1,
        focusDelay: 0,
        blurDelay: 0.15,
        popupStyle: {},
        destroyPopupOnHide: false,
        popupAlign: {},
        defaultPopupVisible: false,
        mask: false,
        maskClosable: true,
        action: [],
        showAction: [],
        hideAction: [],
    };

    constructor(props) {
        super(props);
        let popupVisible;
        if ('popupVisible' in props) {
            popupVisible = !!props.popupVisible;
        } else {
            popupVisible = !!props.defaultPopupVisible;
        }
        this.state = {
            popupVisible,
        }
    }

    componentWillMount() {
        ALL_HANDLERS.forEach((h) => {
            this[`fire${h}`] = (e) => {
                this.fireEvents(h, e);
            };
        });
    }

    componentDidMount() {
        this.componentDidUpdate({}, {
            popupVisible: this.state.popupVisible,
        });
    }

    componentWillReceiveProps(nextProps) {
        let {popupVisible} = nextProps;
        if (popupVisible !== undefined) {
            this.setState({
                popupVisible,
            });
        }
    }

    renderComponent = (componentArg, ready) => {
        renderComponent(this, componentArg, ready);
    }

    clickOutsideHandler;

    componentDidUpdate(_, prevState) {
        const props = this.props;
        const state = this.state;
        this.renderComponent(null, () => {
            if (prevState.popupVisible !== state.popupVisible) {
                props.afterPopupVisibleChange(state.popupVisible);
            }
        });

        if (state.popupVisible) {
            let currentDocument;
            if (!this.clickOutsideHandler && this.isClickToHide()) {
                currentDocument = props.getDocument();
                this.clickOutsideHandler = addEventListener(currentDocument,
                    'click', this.onDocumentClick);
            }
            return;
        }

        this.clearOutsideHandler();
    }

    componentWillUnmount() {
        this.clearDelayTimer();
        this.clearOutsideHandler();
    }

    onMouseEnter = (e) => {
        this.fireEvents('onMouseEnter', e);
        this.delaySetPopupVisible(true, this.props.mouseEnterDelay);
    }

    onMouseLeave = (e) => {
        this.fireEvents('onMouseLeave', e);
        this.delaySetPopupVisible(false, this.props.mouseLeaveDelay);
    }

    onPopupMouseEnter = () => {
        this.clearDelayTimer();
    }

    _component;

    onPopupMouseLeave = (e) => {
        // https://github.com/react-component/trigger/pull/13
        // react bug?
        if (e.relatedTarget && !e.relatedTarget.setTimeout &&
            this._component &&
            contains(this._component.getPopupDomNode(), e.relatedTarget)) {
            return;
        }
        this.delaySetPopupVisible(false, this.props.mouseLeaveDelay);
    }

    focusTime;

    onFocus = (e) => {
        this.fireEvents('onFocus', e);
        // incase focusin and focusout
        this.clearDelayTimer();
        if (this.isFocusToShow()) {
            this.focusTime = Date.now();
            this.delaySetPopupVisible(true, this.props.focusDelay);
        }
    }

    preClickTime;

    onMouseDown = (e) => {
        this.fireEvents('onMouseDown', e);
        this.preClickTime = Date.now();
    }

    onBlur = (e) => {
        this.fireEvents('onBlur', e);
        this.clearDelayTimer();
        if (this.isBlurToHide()) {
            this.delaySetPopupVisible(false, this.props.blurDelay);
        }
    }

    onClick = (event) => {
        this.fireEvents('onClick', event);
        // focus will trigger click
        if (this.focusTime) {
            let preTime;
            if (this.preClickTime) {
                preTime = this.preClickTime;
            }
            if (Math.abs(preTime - this.focusTime) < 20) {
                return;
            }
            this.focusTime = 0;
        }
        this.preClickTime = 0;
        event.preventDefault();
        const nextVisible = !this.state.popupVisible;
        if (this.isClickToHide() && !nextVisible || nextVisible && this.isClickToShow()) {
            this.setPopupVisible(!this.state.popupVisible);
        }
    }

    onDocumentClick = (event) => {
        if (this.props.mask && !this.props.maskClosable) {
            return;
        }
        const target = event.target;
        const root = findDOMNode(this);
        const popupNode = this.getPopupDomNode();
        if (!contains(root, target) && !contains(popupNode, target)) {
            this.close();
        }
    }

    getPopupDomNode = () => {
        // for test
        if (this._component) {
            return this._component.isMounted() ? this._component.getPopupDomNode() : null;
        }
        return null;
    }

    getRootDomNode = () => {
        return findDOMNode(this);
    }

    getPopupClassNameFromAlign = (align) => {
        const className = [];
        const props = this.props;
        const {popupPlacement, builtinPlacements, prefixCls} = props;
        if (popupPlacement && builtinPlacements) {
            className.push(getPopupClassNameFromAlign(builtinPlacements, prefixCls, align));
        }
        if (props.getPopupClassNameFromAlign) {
            className.push(props.getPopupClassNameFromAlign(align));
        }
        return className.join(' ');
    }

    getPopupAlign = () => {
        const props = this.props;
        const {popupPlacement, popupAlign, builtinPlacements} = props;
        if (popupPlacement && builtinPlacements) {
            return getAlignFromPlacement(builtinPlacements, popupPlacement, popupAlign);
        }
        return popupAlign;
    }

    getComponent = () => {
        const {props, state} = this;
        const mouseProps: any = {};
        if (this.isMouseEnterToShow()) {
            mouseProps.onMouseEnter = this.onPopupMouseEnter;
        }
        if (this.isMouseLeaveToHide()) {
            mouseProps.onMouseLeave = this.onPopupMouseLeave;
        }
        return (
            <Popup
                prefixCls={props.prefixCls}
                destroyPopupOnHide={props.destroyPopupOnHide}
                visible={state.popupVisible}
                className={props.popupClassName}
                action={props.action}
                align={this.getPopupAlign()}
                onAlign={props.onPopupAlign}
                animation={props.popupAnimation}
                getClassNameFromAlign={this.getPopupClassNameFromAlign}
                {...mouseProps}
                getRootDomNode={this.getRootDomNode}
                style={props.popupStyle}
                mask={props.mask}
                zIndex={props.zIndex}
                transitionName={props.popupTransitionName}
                maskAnimation={props.maskAnimation}
                maskTransitionName={props.maskTransitionName}
            >
                {typeof props.popup === 'function' ? props.popup() : props.popup}
            </Popup>
        );
    }

    setPopupVisible = (popupVisible) => {
        this.clearDelayTimer();
        if (this.state.popupVisible !== popupVisible) {
            if (!('popupVisible' in this.props)) {
                this.setState({
                    popupVisible,
                });
            }
            this.props.onPopupVisibleChange(popupVisible);
        }
    }

    delayTimer;

    delaySetPopupVisible = (visible, delayS) => {
        const delay = delayS * 1000;
        this.clearDelayTimer();
        if (delay) {
            this.delayTimer = setTimeout(() => {
                this.setPopupVisible(visible);
                this.clearDelayTimer();
            }, delay);
        } else {
            this.setPopupVisible(visible);
        }
    }

    clearDelayTimer = () => {
        if (this.delayTimer) {
            clearTimeout(this.delayTimer);
            this.delayTimer = null;
        }
    }

    clearOutsideHandler = () => {
        if (this.clickOutsideHandler) {
            this.clickOutsideHandler.remove();
            this.clickOutsideHandler = null;
        }
    }

    createTwoChains = (event) => {
        const childPros = this.props.children.props;
        const props = this.props;
        if (childPros[event] && props[event]) {
            return this[`fire${event}`];
        }
        return childPros[event] || props[event];
    }

    isClickToShow = () => {
        const {action, showAction} = this.props;
        return action.indexOf('click') !== -1 || showAction.indexOf('click') !== -1;
    }

    isClickToHide = () => {
        const {action, hideAction} = this.props;
        return action.indexOf('click') !== -1 || hideAction.indexOf('click') !== -1;
    }

    isMouseEnterToShow = () => {
        const {action, showAction} = this.props;
        return action.indexOf('hover') !== -1 || showAction.indexOf('mouseEnter') !== -1;
    }

    isMouseLeaveToHide = () => {
        const {action, hideAction} = this.props;
        return action.indexOf('hover') !== -1 || hideAction.indexOf('mouseLeave') !== -1;
    }

    isFocusToShow = () => {
        const {action, showAction} = this.props;
        return action.indexOf('focus') !== -1 || showAction.indexOf('focus') !== -1;
    }

    isBlurToHide = () => {
        const {action, hideAction} = this.props;
        return action.indexOf('focus') !== -1 || hideAction.indexOf('blur') !== -1;
    }

    popupInstance;

    forcePopupAlign = () => {
        if (this.state.popupVisible && this.popupInstance && this.popupInstance.alignInstance) {
            this.popupInstance.alignInstance.forceAlign();
        }
    }

    fireEvents = (type, e) => {
        const childCallback = this.props.children.props[type];
        if (childCallback) {
            childCallback(e);
        }
        const callback = this.props[type];
        if (callback) {
            callback(e);
        }
    }

    close = () => {
        this.setPopupVisible(false);
    }

    render() {
        const props = this.props;
        const children = props.children;
        const child = Children.only(children);
        const newChildProps: any = {};
        if (this.isClickToHide() || this.isClickToShow()) {
            newChildProps.onClick = this.onClick;
            newChildProps.onMouseDown = this.onMouseDown;
        } else {
            newChildProps.onClick = this.createTwoChains('onClick');
            newChildProps.onMouseDown = this.createTwoChains('onMouseDown');
        }
        if (this.isMouseEnterToShow()) {
            newChildProps.onMouseEnter = this.onMouseEnter;
        } else {
            newChildProps.onMouseEnter = this.createTwoChains('onMouseEnter');
        }
        if (this.isMouseLeaveToHide()) {
            newChildProps.onMouseLeave = this.onMouseLeave;
        } else {
            newChildProps.onMouseLeave = this.createTwoChains('onMouseLeave');
        }
        if (this.isFocusToShow() || this.isBlurToHide()) {
            newChildProps.onFocus = this.onFocus;
            newChildProps.onBlur = this.onBlur;
        } else {
            newChildProps.onFocus = this.createTwoChains('onFocus');
            newChildProps.onBlur = this.createTwoChains('onBlur');
        }

        return cloneElement(child, newChildProps);
    }
}
