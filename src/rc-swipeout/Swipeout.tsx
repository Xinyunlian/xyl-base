import createElement from 'inferno-create-element';
import Component from 'inferno-component';
import {observer} from 'inferno-mobx';
import Hammer from '../rc-hammerjs';
import omit from 'object.omit';
import splitObject from './util/splitObject';
import {ISwipeoutPropTypes} from "./PropsType";
import noop from "../rc-util/noop";

@observer
class Swipeout extends Component<ISwipeoutPropTypes, any> {

    static defaultProps = {
        prefixCls: 'xyl-base/lib/rc-swipeout',
        autoClose: false,
        disabled: false,
        left: [],
        right: [],
        onOpen: noop,
        onClose: noop,
    };

    openedLeft: boolean;
    openedRight: boolean;
    contentWidth: number;
    btnsLeftWidth: number;
    btnsRightWidth: number;
    panStartX: number;
    left;
    right;

    constructor(props) {
        super(props);

        this.onPanStart = this.onPanStart.bind(this);
        this.onPan = this.onPan.bind(this);
        this.onPanEnd = this.onPanEnd.bind(this);

        this.openedLeft = false;
        this.openedRight = false;
    }

    componentDidMount() {
        const {left, right} = this.props;
        const width = this.content.offsetWidth;

        if (this.cover) {
            this.cover.style.width = `${width}px`;
        }

        this.contentWidth = width;
        this.btnsLeftWidth = (width / 5) * left.length;
        this.btnsRightWidth = (width / 5) * right.length;

        document.body.addEventListener('touchstart', this.onCloseSwipe.bind(this), true);
    }

    componentWillUnmount() {
        document.body.removeEventListener('touchstart', this.onCloseSwipe.bind(this));
    }

    onCloseSwipe(ev) {
        if (this.openedLeft || this.openedRight) {
            const pNode = (node => {
                while (node.parentNode && node.parentNode !== document.body) {
                    if (node.className.indexOf(`${this.props.prefixCls}-actions`) > -1) {
                        return node;
                    }
                    node = node.parentNode;
                }
            })(ev.target);
            if (!pNode) {
                ev.preventDefault();
                this.close();
            }
        }
    }

    onPanStart(e) {
        if (this.props.disabled) {
            return;
        }
        this.panStartX = e.deltaX;
    }

    onPan(e) {
        if (this.props.disabled) {
            return;
        }
        const {left, right} = this.props;
        const posX = e.deltaX - this.panStartX;
        if (posX < 0 && right.length) {
            this._setStyle(Math.min(posX, 0));
        } else if (posX > 0 && left.length) {
            this._setStyle(Math.max(posX, 0));
        }
    }

    onPanEnd(e) {
        if (this.props.disabled) {
            return;
        }

        const {left, right} = this.props;
        const posX = e.deltaX - this.panStartX;
        const contentWidth = this.contentWidth;
        const btnsLeftWidth = this.btnsLeftWidth;
        const btnsRightWidth = this.btnsRightWidth;
        const openX = contentWidth * 0.33;
        const openLeft = posX > openX || posX > btnsLeftWidth / 2;
        const openRight = posX < -openX || posX < -btnsRightWidth / 2;

        if (openRight && posX < 0 && right.length) {
            this.open(-btnsRightWidth, false, true);
        } else if (openLeft && posX > 0 && left.length) {
            this.open(btnsLeftWidth, true, false);
        } else {
            this.close();
        }
    }

    // left & right button click
    onBtnClick(ev, btn) {
        const onPress = btn.onPress;
        if (onPress) {
            onPress(ev);
        }
        if (this.props.autoClose) {
            this.close();
        }
    }

    _getContentEasing(value, limit) {
        // limit content style left when value > actions width
        if (value < 0 && value < limit) {
            return limit - Math.pow(limit - value, 0.85);
        } else if (value > 0 && value > limit) {
            return limit + Math.pow(value - limit, 0.85);
        }
        return value;
    }

    // set content & actions style
    _setStyle(value) {
        const {left, right} = this.props;
        const limit = value > 0 ? this.btnsLeftWidth : -this.btnsRightWidth;
        const contentLeft = this._getContentEasing(value, limit);
        this.content.style.left = `${contentLeft}px`;
        this.cover.style.display = Math.abs(value) > 0 ? 'block' : 'none';
        this.cover.style.left = `${contentLeft}px`;
        if (left.length) {
            const leftWidth = Math.max(Math.min(value, Math.abs(limit)), 0);
            this.left.style.width = `${leftWidth}px`;
        }
        if (right.length) {
            const rightWidth = Math.max(Math.min(-value, Math.abs(limit)), 0);
            this.right.style.width = `${rightWidth}px`;
        }
    }

    open(value, openedLeft, openedRight) {
        if (!this.openedLeft && !this.openedRight) {
            this.props.onOpen();
        }

        this.openedLeft = openedLeft;
        this.openedRight = openedRight;
        this._setStyle(value);
    }

    close() {
        if (this.openedLeft || this.openedRight) {
            this.props.onClose();
        }
        this._setStyle(0);
        this.openedLeft = false;
        this.openedRight = false;
    }

    renderButtons(buttons, ref) {
        const prefixCls = this.props.prefixCls;

        return (buttons && buttons.length) ? (
            <div
                className={`${prefixCls}-actions
                ${prefixCls}-actions-${ref}`}
                ref={(_ref) => {
                    this[ref] = _ref;
                }}
            >
                {buttons.map((btn, i) => {
                    return (
                        <div
                            key={i}
                            className={`${prefixCls}-btn ${btn.hasOwnProperty('className') ? btn.className : ''}`}
                            style={btn.style}
                            role="button"
                            onClick={(e) => this.onBtnClick(e, btn)}
                        >
                            <div className={`${prefixCls}-text`}>{btn.text || 'Click'}</div>
                        </div>
                    );
                })}
            </div>
        ) : null;
    }

    cover;
    coverBind = (cover) => {
        this.cover = cover;
    }
    content;
    contentBind = (content) => {
        this.content = content;
    }

    render() {
        const [{prefixCls, left, right, children}, restProps] = splitObject(
            this.props,
            ['prefixCls', 'left', 'right', 'children']
        );
        const divProps = omit(restProps, [
            'disabled',
            'autoClose',
            'onOpen',
            'onClose',
        ]);

        return (left.length || right.length) ? (
            <div className={`${prefixCls}`} {...divProps as any}>
                {/* 保证 body touchStart 后不触发 pan */}
                <div className={`${prefixCls}-cover`} ref={this.coverBind}/>
                {this.renderButtons(left, 'left')}
                {this.renderButtons(right, 'right')}
                <Hammer
                    direction="DIRECTION_HORIZONTAL"
                    onPanStart={this.onPanStart}
                    onPan={this.onPan}
                    onPanEnd={this.onPanEnd}
                >
                    <div className={`${prefixCls}-content`} ref={this.contentBind}>
                        {children}
                    </div>
                </Hammer>
            </div>
        ) : (
            <div ref={this.contentBind} {...divProps as any}>{children}</div>
        );
    }
}

export default Swipeout;
