// ==UserScript==
// @name         Infinite Campus Grade Hider
// @namespace    http://tampermonkey.net
// @version      0.1.0
// @description  Hides grades on Infinite Campus until you click to reveal them.
// @match        https://*.infinitecampus.org/*
// @match        https://*.infinitecampus.com/*
// @include      https://campus.*.k12.*.us/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

function waitForElement(selector, { text, timeout = 0 } = {}) {
    return new Promise((resolve, reject) => {
        const matches = (el) => {
            if (!text) return true;
            const content = el.textContent;
            return text instanceof RegExp ? text.test(content) : content.includes(text);
        };

        const find = () =>
            [...document.querySelectorAll(selector)].find(matches) || null;

        let timer = null;

        const check = () => {
            const el = find();
            if (el) {
                if (timer) clearTimeout(timer);
                observer.disconnect();
                resolve(el);
            }
        };

        const observer = new MutationObserver(check);

        // timeout of 0 = wait forever
        if (timeout > 0) {
            timer = setTimeout(() => {
                observer.disconnect();
                reject(new Error(`Timed out after ${timeout}ms waiting for ${selector}`));
            }, timeout);
        }

        observer.observe(document.documentElement, {
            childList: true,
            subtree: true,
            characterData: true,
        });

        check();
    });
}

function fadeInText(el, text, duration = 1000) {
    const half = duration / 2;
    el.style.transition = `opacity ${half}ms ease`;
    el.style.opacity = "0";

    setTimeout(() => {
        el.textContent = text;
        el.style.opacity = "1"; // transition is still set, so this fades in
    }, half);
}

function handleDashboardGrades() {
    const scoreRegex = /^\s*\d+(\.\d+)?\s*\/\s*\d+(\.\d+)?\s*$/;

    const gradeText = [...document.querySelectorAll("*:not([data-icgh])")].filter(el =>
        el.children.length === 0 && scoreRegex.test(el.textContent)
    );

    gradeText.forEach(el => {
        const gradeContainer = el.parentElement.parentElement;
        const sibling = el.nextElementSibling;

        el.dataset.originalText = el.textContent;
        el.dataset.icgh = "1";
        if (sibling) {
            sibling.dataset.originalText = sibling.textContent;
            sibling.dataset.icgh = "1";
        }

        el.textContent = "Grade Hidden";
        if (sibling) sibling.textContent = "Click to reveal";

        gradeContainer.closest(".selcat-assignment-row").addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            fadeInText(el, el.dataset.originalText);
            if (sibling) fadeInText(sibling, sibling.dataset.originalText); // last element check
        }, { capture: true, once: true });
    });
}

async function handleNotifGrades() {
    await waitForElement("a.notification__text");

    const notifText = [...document.querySelectorAll("a.notification__text")];
    notifText.forEach(el => {
        const gradeText = el.textContent;
        const gradeDate = el.nextElementSibling.textContent;

        if (el.textContent.includes("received a score of")) {
            el.textContent = "Grade Hidden";
            el.nextElementSibling.textContent = "Click to reveal";
        }

        if (el.textContent.includes("has an updated grade of")) {
            el.textContent = "Average Update Hidden";
            el.nextElementSibling.textContent = "Click to reveal";
        }

        el.closest("li").style.cursor = "pointer";

        el.closest("li").addEventListener("click", (e) => {
            el.closest("li").style.cursor = "default";

            e.preventDefault();
            e.stopPropagation();
            fadeInText(el, gradeText);
            if (el.nextElementSibling) fadeInText(el.nextElementSibling, gradeDate);
        }, { capture: true, once: true });
    });
}

async function main() {
    try {
        const h2 = await waitForElement("h2.card__header--small", {
            text: /Assignments:\s*To-Do/,
        });
        // console.log("[ICGH] Site loaded!", h2);

        handleDashboardGrades();
        await waitForElement("a.notification__text");
    } catch (err) {
        console.error("[ICGH] failed:", err);
    }
}

(function () {
    'use strict';
    console.log("[ICGH] Script loaded!");
    main();
    handleNotifGrades(); // not in iframe so dont neet to wait for header to load before running this

    let timer; // STOP SPAMMING MY CONSOLE
    new MutationObserver(() => {
        clearTimeout(timer);
        timer = setTimeout(main, 100);
    }).observe(document.documentElement, { childList: true, subtree: true });
})();
