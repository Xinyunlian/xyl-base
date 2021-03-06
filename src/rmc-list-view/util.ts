export function getOffsetTop(elem) {
    let offsetTop = 0;
    /* eslint no-cond-assign: 0 */
    do {
        if (!isNaN(elem.offsetTop)) {
            offsetTop += elem.offsetTop;
        }
    } while (elem = elem.offsetParent);
    return offsetTop;
}

export function _event(e) {
    if (e.touches && e.touches.length) {
        return e.touches[0];
    }
    if (e.changedTouches && e.changedTouches.length) {
        return e.changedTouches[0];
    }
    return e;
}

export function throttle(fn, delay) {
    let allowSample = true;
    return function _throttle(e) {
        if (allowSample) {
            allowSample = false;
            setTimeout(() => {
                allowSample = true;
            }, delay);
            fn(e);
        }
    };
}
