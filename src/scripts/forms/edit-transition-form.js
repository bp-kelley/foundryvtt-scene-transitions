import CONSTANTS from "../constants.js";
import Logger from "../logger.js";
import { Utils } from "../utils.js";
import DefaultOptionsForm from "./default-options-form.js";

/**
 * Form controller for editing transitions
 */
export default class EditTransitionForm extends DefaultOptionsForm {
    constructor(object, options) {
        super(object, options);
        this.transition = object || {};
        this.data = {};
        this.interval = null;
    }

    /**
     *
     */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "scene-transitions-form",
            title: game.i18n.localize("scene-transitions.editSceneTransition"),
            template: CONSTANTS.TEMPLATE.EDIT_TRANSITION_FORM,
            classes: ["sheet", "scene-transitions-form"],
            width: 400,
            height: 680,
            left: "100px",
            closeOnSubmit: true,
            minimizable: true,
            resizable: true,
        });
    }

    /**
     * Get data for the triggler form
     */
    async getData(options) {
        const context = this.transition.options;
        context.default = CONSTANTS.DEFAULT_SETTING;
        context.isEdit = true;
        context.transitionContent = await (foundry.applications?.ux?.TextEditor?.implementation ?? TextEditor).enrichHTML(this.transition.options.content, {
            secrets: true,
            async: true,
        });

        return context;
    }

    /** @inheritdoc */
    async activateEditor(name, options = {}, initialContent = "") {
        // options.relativeLinks = true;
        options.plugins = {
            menu: ProseMirror.ProseMirrorMenu.build(ProseMirror.defaultSchema, {
                compact: true,
                destroyOnSave: false,
                onSave: () => {
                    this._saveEditor(name, { remove: false });
                },
            }),
        };
        return super.activateEditor(name, options, initialContent);
    }

    /**
     * Handle saving the content of a specific editor by name
     * @param {string} name           The named editor to save
     * @param {boolean} [remove]      Remove the editor after saving its content
     * @returns {Promise<void>}
     */
    async _saveEditor(name, { remove = true } = {}) {
        const editor = this.editors[name];
        if (!editor || !editor.instance) throw new Error(`${name} is not an active editor name!`);
        editor.active = false;
        const { instance } = editor;
        await this._onSubmit(new Event("submit"), {
            preventClose: true,
        });

        // Remove the editor
        if (remove) {
            instance.destroy();
            editor.instance = editor.mce = null;
            if (editor.hasButton) editor.button.style.display = "block";
            this.render();
        }
        editor.changed = false;
    }

    async activateListeners(html) {
        super.activateListeners(html);

        const contentHTML = await (foundry.applications?.ux?.TextEditor?.implementation ?? TextEditor).enrichHTML(this.transition.options.content, {
            secrets: true,
            async: true,
        });
        $('[data-edit="content"]').html(contentHTML);

        // Select by name so this works whatever element the colorPicker helper renders
        // (<color-picker> on v12-v13, a different element on v14), and skip missing fields
        // instead of throwing and leaving the form half set up.
        const root = html?.[0] ?? html;
        const listen = (selector, events, handler) => {
            const elements = root?.querySelectorAll?.(selector) ?? [];
            if (!elements.length) {
                Logger.debug(`Edit transition form: no element for ${selector}`);
                return;
            }
            const bound = handler.bind(this);
            for (const element of elements) {
                for (const eventName of events) element.addEventListener(eventName, bound);
            }
        };

        listen('[name="fontColor"]', ["change", "input"], this.#updateFontColor);
        listen('input[name="fontSize"]', ["change"], this.#updateFontSize);

        // Figure out how to listen to all editor events
        listen(".editor-content", ["input", "cut", "paste"], this.#updateContent);

        listen('input[name="bgImg"]', ["change"], this.#updateBgImage);
        listen('input[name="bgPos"]', ["change"], this.#updateBgPos);
        listen('input[name="bgSize"]', ["change"], this.#updateBgSize);
        listen('[name="bgColor"]', ["change", "input"], this.#updateBgColor);
        listen('input[name="bgOpacity"]', ["change"], this.#updateBgOpacity);
        listen('input[name="audio"]', ["change"], this.#updateAudio);
        listen('input[name="volume"]', ["change"], this.#updateVolume);
    }

    #updateFontColor(event) {
        if (!this.transition.element) {
            return;
        }
        this.transition.element.querySelector(".scene-transitions-content").style.color = event.target.value;
    }

    #updateFontSize(event) {
        if (!this.transition.element) {
            return;
        }
        this.transition.element.querySelector(".scene-transitions-content").style.fontSize = `${event.target.value}px`;
    }

    #updateContent(event) {
        if (!this.transition.element) {
            return;
        }
        const editorTarget = this.editors?.content?.options?.target ?? event.currentTarget;
        if (!editorTarget) return;
        this.transition.element.querySelector(".scene-transitions-content").innerHTML = editorTarget.innerHTML;
    }

    #updateBgImage(event) {
        if (!this.transition.element) {
            return;
        }
        this.transition.element.querySelector(".scene-transitions-bg").style.backgroundImage =
            `url('${event.target.value}')`;
    }

    #updateBgPos(event) {
        if (!this.transition.element) {
            return;
        }
        this.transition.element.querySelector(".scene-transitions-bg").style.backgroundPosition = event.target.value;
    }

    #updateBgSize(event) {
        if (!this.transition.element) {
            return;
        }
        this.transition.element.querySelector(".scene-transitions-bg").style.backgroundSize = event.target.value;
    }

    #updateBgColor(event) {
        if (!this.transition.element) {
            return;
        }
        this.transition.element.querySelector(".scene-transitions-bg").style.backgroundColor = event.target.value;
    }

    #updateBgOpacity(event) {
        if (!this.transition.element) {
            return;
        }
        this.transition.element.querySelector(".scene-transitions-bg").style.opacity = event.target.value;
    }

    #updateAudio(event) {
        this.transition.playAudio(event.target.value);
    }

    #updateVolume(event) {
        if (this.transition.audio?.playing) {
            this.transition.audio.gain.value = event.target.value;
        }
    }

    // @ts-ignore
    close() {
        this.transition.destroy(true);
        super.close({ force: true });
    }

    async _updateObject(event, formData) {
        this.transition.updateData(formData);

        const scene = game.scenes?.get(this.transition.options.sceneID);

        if (this.transition.options.sceneID && scene) {
            await scene.setFlag(CONSTANTS.MODULE.ID, "transition", this.transition);
        } else {
            Logger.warn(`No scene has been found with id ${this.transition.options.sceneID}`);
            return;
        }
    }
}
