# ChatGPT Conservative Anti-Freeze for Long Chats

## Description:
This Tampermonkey/GreaseMonkey script dynamically detaches older chat turns and replaces them with lightweight placeholders, significantly reducing DOM load and improving streaming chat experience.
It does not modify prototypes or patch native functions, ensuring safe and conservative operation while keeping native streaming intact.

## Configuration:
const VISIBLE_KEEP = 8  // Number of most recent turns to keep visible
const REVEAL_BATCH = 8  // Number of turns to restore when scrolling up
For very long chats (>200 turns): VISIBLE_KEEP = 6, REVEAL_BATCH = 4
For medium-length chats: default values work well
For short chats: VISIBLE_KEEP can be increased to 16 or more

## Compatibility:
ChatGPT Web: https://chat.openai.com/*
ChatGPT.com: https://chatgpt.com/*
Browsers: Chrome, Firefox, Edge (with Tampermonkey or GreaseMonkey)

## Installation:
Install Tampermonkey or GreaseMonkey
Create a new script and paste [chatgpt-detach.js](https://github.com/aston89/ChatGPT-Conservative-Anti-Freeze-for-Long-Chats/blob/main/chatgpt-detach.js)
Save and enable the script
Use the Detach ON/OFF button at the bottom-right to toggle functionality
If you are using Firefox, [check this parameter tweak !](https://github.com/aston89/ChatGPT-Conservative-Anti-Freeze-for-Long-Chats/blob/main/firefox-tweak.md)

## How it works:
The script observes the chat feed using a MutationObserver
When the DOM exceeds VISIBLE_KEEP turns, the oldest turns are detached and replaced with lightweight comment placeholders
Scrolling up restores REVEAL_BATCH older turns to allow reading without overloading the UI
At the end of the stream or on command, all turns are flushed and reinserted

## Advantages of This Approach:
- Non-invasive DOM management. (Only the oldest chat turns are detached and replaced with lightweight placeholders, leaving the active stream untouched)
- Batching and debounce for performance. (Older turns are restored in small batches only when needed, preventing UI freezes or lag.
- Conservative streaming handling.(The script detects stream activity and flushes turns appropriately, ensuring smooth rendering of new messages)
- Future compatibility. (By avoiding aggressive prototype patches or complex DOM manipulations, this approach is less likely to break with updates to ChatGPT Web)
- This method focuses on maintaining fluidity in long chats while keeping the interface responsive and easy to use.

## TL;DR:
This approach resolves long-standing freezes and lag issues in long chats.
Conservative and non-invasive: streaming and token flow remain fully intact
Optimizes the DOM without sacrificing user experience

## Post Scriptum:
I know "[lazychat++](https://github.com/AlexSHamilton/chatgpt-lazy-chat-plusplus)" exist but for me it never worked as intended.

