import API from "./scripts/api.js";
import CONSTANTS from "./scripts/constants.js";
import { registerSettings } from "./scripts/settings.js";
import { registerSocket, sceneTransitionsSocket } from "./scripts/socket.js";
import { SceneTransitionOptions } from "./scripts/scene-transition-options.js";
import { SceneTransition } from "./scripts/scene-transition.js";
import { Utils } from "./scripts/utils.js";

Hooks.once("init", async () => {
    registerSettings();
    registerSocket();
});

Hooks.once("setup", () => {
    game.modules.get(CONSTANTS.MODULE.ID).api = API;
});

Hooks.once("devModeReady", ({ registerPackageDebugFlag }) => {
    registerPackageDebugFlag(CONSTANTS.MODULE.ID);
});

/** ******************
 * Adds menu option to Scene Nav and Directory
 *******************/
Hooks.on("getSceneContextOptions", (directory, contextOptions) => {
    addContextButtons("getSceneContextOptions", contextOptions);
});

// Try multiple approaches for journal entries to ensure coverage
Hooks.on("getDocumentContextOptions", (application, contextOptions) => {
    if (application.document?.documentName === "JournalEntry") {
        addContextButtons("getJournalEntryContextOptions", contextOptions);
    } else if (application.document?.documentName === "JournalEntryPage") {
        addContextButtons("getJournalEntryPageContextOptions", contextOptions);
    }
});

// Also try the specific journal entry hook if it exists
Hooks.on("getJournalEntryContextOptions", (application, contextOptions) => {
    addContextButtons("getJournalEntryContextOptions", contextOptions);
});

// Try specific journal page hook
Hooks.on("getJournalEntryPageContextOptions", (application, contextOptions) => {
    addContextButtons("getJournalEntryPageContextOptions", contextOptions);
});

// Fallback for journal directory context
Hooks.on("getJournalDirectoryContextOptions", (application, contextOptions) => {
    addContextButtons("getJournalEntryContextOptions", contextOptions);
});

// v13+ journals use the ApplicationV2 JournalEntrySheet; keep the v1 hook for older sheets
Hooks.on("renderJournalEntrySheet", (journal, element) => addJournalButton(journal, element));
Hooks.on("renderJournalSheet", (journal, html) => addJournalButton(journal, html));

/**
 * Add Create, Edit, Delete, Play context buttons
 * @param {string} hookName      The hook name
 * @param {Array} contextOptions The context options
 */
function addContextButtons(hookName, contextOptions) {
    if (hookName === "getJournalEntryContextOptions") {
        contextOptions.push(SceneTransition.addPlayTransitionBtnJE());
        return;
    }

    if (hookName === "getJournalEntryPageContextOptions") {
        contextOptions.push(SceneTransition.addPlayTransitionBtnJEPage());
        return;
    }

    // For Scene documents
    if (hookName === "getSceneContextOptions") {
        contextOptions.push(SceneTransition.addPlayTransitionBtn());
        contextOptions.push(SceneTransition.addCreateTransitionBtn());
        contextOptions.push(SceneTransition.addEditTransitionBtn());
        contextOptions.push(SceneTransition.addDeleteTransitionBtn());
    }
}

/**
 * Add 'Play as Transition' button to Journal header
 * @param {object} journal             The journal sheet
 * @param {HTMLElement|jQuery} html    The rendered element passed by the render hook
 */
function addJournalButton(journal, html) {
    const pageTypes = ["image", "text", "video"];

    if (!game.user?.isGM) return;

    const showJournalHeaderSetting = game.settings.get(CONSTANTS.MODULE.ID, CONSTANTS.SETTING.SHOW_JOURNAL_HEADER);
    if (!showJournalHeaderSetting) return;

    // ApplicationV2 passes an HTMLElement, v1 passes jQuery. Always use the window's root element.
    const root = journal.element instanceof HTMLElement ? journal.element : (journal.element?.[0] ?? html?.[0] ?? html);
    const header = root?.querySelector?.("header.window-header") ?? root?.querySelector?.("header");
    if (!header) return;

    const windowTitle = header.querySelector(".window-title");
    if (!windowTitle) return;

    const existingLink = header.querySelector(".play-transition");
    if (existingLink) existingLink.remove();

    const page = journal.document?.pages?.contents?.sort((a, b) => a.sort - b.sort)[0];
    if (!page || !pageTypes.includes(page.type)) return;

    const label = "Play as Transition";
    let linkElement;
    if (journal instanceof foundry.applications.api.ApplicationV2) {
        linkElement = document.createElement("button");
        linkElement.type = "button";
        linkElement.classList.add("header-control", "icon", "fa-solid", "fa-circle-play", "play-transition");
        linkElement.dataset.tooltip = label;
        linkElement.setAttribute("aria-label", label);
    } else {
        linkElement = document.createElement("a");
        linkElement.classList.add("play-transition");
        linkElement.innerHTML = `<i class="fas fa-play-circle"></i>${label}`;
    }
    windowTitle.after(linkElement);

    linkElement.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        onClickJournalButton(page);
    });
}

/**
 * Handle click event on journal button to create transition
 * @param {object} page The journal page
 */
function onClickJournalButton(page) {
    let content = null;
    let bgImg = null;
    let bgLoop = null;
    let volume = null;

    switch (page.type) {
        case "image":
            bgImg = page.src;
            break;
        case "text":
            content = Utils.getTextFromPage(page);
            bgImg = Utils.getFirstImageFromPage(page);
            break;
        case "video":
            bgImg = page.src;
            bgLoop = page.video.loop;
            volume = page.video.volume;
            break;
        default:
            return;
    }

    const options = new SceneTransitionOptions({ content, bgImg, bgLoop });
    sceneTransitionsSocket.executeForEveryone("executeAction", options);
}
