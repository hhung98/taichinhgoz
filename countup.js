/**
 * CountUp Component (Ported from React Bits)
 * High-performance 60-120 FPS animated counter engine with easing, tabular-nums,
 * currency formatting, and race-condition protection.
 */
(function (window) {
    'use strict';

    const _activeAnimations = new WeakMap();

    // Easing equations matching React Bits CountUp specification
    const cubicBezierEaseOut = t => 1 - Math.pow(1 - t, 3);
    const expoEaseOut = t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
    const springEase = t => {
        if (t >= 1) return 1;
        return 1 - Math.exp(-6 * t) * Math.cos(7 * t);
    };

    const EASINGS = {
        easeOut: cubicBezierEaseOut,
        expo: expoEaseOut,
        spring: springEase,
        linear: t => t
    };

    function parseNumericValue(text) {
        if (!text || typeof text !== 'string') return 0;
        const isUSD = text.includes('$');
        if (isUSD) {
            const cleaned = text.replace(/[^0-9.-]/g, '');
            const val = parseFloat(cleaned);
            return isNaN(val) ? 0 : val;
        }
        // VN & KRW are integer currency values: dots and commas are thousand separators
        const cleaned = text.replace(/[^0-9-]/g, '');
        const val = parseInt(cleaned, 10);
        return isNaN(val) ? 0 : val;
    }

    function formatNumber(val, { currency = 'VND', decimals, separator, prefix, suffix }) {
        if (window.isPrivacyMode) return '••••••••';

        const num = Number(val) || 0;
        const cur = currency ? currency.toUpperCase() : 'VND';

        // Auto defaults based on currency
        const dec = decimals !== undefined ? decimals : (cur === 'USD' ? 2 : 0);
        const sep = separator !== undefined ? separator : (cur === 'USD' ? ',' : '.');
        const pre = prefix !== undefined ? prefix : (cur === 'USD' ? '$' : '');
        const suf = suffix !== undefined ? suffix : (cur === 'KRW' ? ' ₩' : (cur === 'VND' ? ' ₫' : ''));

        const fixed = Math.abs(num).toFixed(dec);
        const parts = fixed.split('.');
        const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, sep);
        const decPart = dec > 0 && parts[1] ? (sep === '.' ? ',' : '.') + parts[1] : '';
        const sign = num < 0 && Math.round(num) !== 0 ? '-' : '';

        return `${sign}${pre}${intPart}${decPart}${suf}`;
    }

    function CountUp(elementOrSelector, options = {}) {
        const el = typeof elementOrSelector === 'string'
            ? document.getElementById(elementOrSelector) || document.querySelector(elementOrSelector)
            : elementOrSelector;

        if (!el) return;

        // Ensure tabular-nums font variant so digits never jitter horizontally
        el.style.fontVariantNumeric = 'tabular-nums';

        if (window.isPrivacyMode) {
            el.textContent = '••••••••';
            return;
        }

        const toVal = Number(options.to !== undefined ? options.to : parseNumericValue(el.textContent));
        const prevVal = el._countUpCurrentVal !== undefined
            ? el._countUpCurrentVal
            : parseNumericValue(el.textContent);
        const fromVal = Number(options.from !== undefined ? options.from : prevVal);

        const duration = typeof options.duration === 'number' ? options.duration : 0.45; // 450ms snappy & smooth roll
        const delay = (options.delay || 0) * 1000;
        const easing = options.easing || 'easeOut';
        const easeFn = EASINGS[easing] || EASINGS.easeOut;

        const currency = options.currency || window.displayCurrency || 'VND';
        const decimals = options.decimals;
        const separator = options.separator;
        const prefix = options.prefix;
        const suffix = options.suffix;

        // Cancel previous running animation on this element to prevent collisions
        if (_activeAnimations.has(el)) {
            cancelAnimationFrame(_activeAnimations.get(el));
            _activeAnimations.delete(el);
        }

        // Setup hover replay if requested
        if (options.replayOnHover && !el._hasHoverReplay) {
            el._hasHoverReplay = true;
            el.addEventListener('mouseenter', () => {
                if (window.isPrivacyMode) return;
                CountUp(el, { ...options, from: 0, to: el._countUpTargetVal !== undefined ? el._countUpTargetVal : toVal, duration: 0.65 });
            });
        }

        el._countUpTargetVal = toVal;

        // If reduced motion is requested, render immediately
        if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
            el._countUpCurrentVal = toVal;
            el.textContent = formatNumber(toVal, { currency, decimals, separator, prefix, suffix });
            return;
        }

        // If target and current are equal, format and set immediately
        if (Math.abs(toVal - fromVal) < 0.0001 && el.textContent) {
            el._countUpCurrentVal = toVal;
            el.textContent = formatNumber(toVal, { currency, decimals, separator, prefix, suffix });
            return;
        }

        const durationMs = Math.max(150, duration * 1000);
        let startTimestamp = null;

        if (typeof options.onStart === 'function') options.onStart();

        function renderFrame(now) {
            if (!startTimestamp) startTimestamp = now;
            const elapsed = now - startTimestamp;

            if (elapsed < delay) {
                const id = requestAnimationFrame(renderFrame);
                _activeAnimations.set(el, id);
                return;
            }

            const activeElapsed = elapsed - delay;
            const progress = Math.min(1, Math.max(0, activeElapsed / durationMs));
            const easedProgress = easeFn(progress);

            const current = fromVal + (toVal - fromVal) * easedProgress;
            el._countUpCurrentVal = current;
            el.textContent = formatNumber(current, { currency, decimals, separator, prefix, suffix });

            if (progress < 1) {
                const id = requestAnimationFrame(renderFrame);
                _activeAnimations.set(el, id);
            } else {
                el._countUpCurrentVal = toVal;
                el.textContent = formatNumber(toVal, { currency, decimals, separator, prefix, suffix });
                _activeAnimations.delete(el);
                if (typeof options.onEnd === 'function') options.onEnd();
            }
        }

        const firstId = requestAnimationFrame(renderFrame);
        _activeAnimations.set(el, firstId);
    }

    window.CountUp = CountUp;
    window.countUp = CountUp;
})(window);

