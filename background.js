chrome.runtime.onInstalled.addListener(() => {
    console.log('Extension installed');
});

// chrome.scripting.registerContentScripts([
//     {
//         // js: [{ file: "/content2.js" }],
//         // matches: ["<all_urls>"],
//         // allFrames: true,
//         // runAt:"document_start",

//         id:"n0code-tweaks",
//         runAt:"document_start",
//         // matches:["https://n0code.net/work/teaching/courses/index.html"],
//         matches: ["<all_urls>"],
//         js:["/content2.js"]
//     }
// ]);