chrome.runtime.onInstalled.addListener(() => {
    console.log('Extension installed');
});

chrome.scripting.registerContentScripts([
    {
        id:"tweaks",
        matches:["https://n0code.net/work/teaching/courses/index.html"],
        js:["content2.js"]
    }
]);