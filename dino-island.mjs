// =============================================================
// ESCAPE FROM DINO ISLAND – Foundry VTT Game System v3
// =============================================================

import { DinoIslandActor } from "./module/actor.mjs";
import { DinoIslandItem }  from "./module/item.mjs";
import { DINO }            from "./module/config.mjs";

Hooks.once("init", function () {
  console.log("DinoIsland | System startet…");

  game.dino = { rollMove, config: DINO };
  CONFIG.DINO = DINO;
  CONFIG.Actor.documentClass = DinoIslandActor;
  CONFIG.Item.documentClass  = DinoIslandItem;

  const { HandlebarsApplicationMixin } = foundry.applications.api;
  const { ActorSheetV2 }               = foundry.applications.sheets;
  const { DocumentSheetV2 }            = foundry.applications.api;

  // ---- ACTOR SHEET ----
  class DinoActorSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
    static DEFAULT_OPTIONS = {
      classes: ["dino-island", "sheet", "actor"],
      position: { width: 720, height: 820 },
      window: { resizable: true },
      form: { submitOnChange: true, closeOnSubmit: false },
      actions: {
        rollMove:    DinoActorSheet._onRollMove,
        rollStat:    DinoActorSheet._onStatRoll,
        storyChange: DinoActorSheet._onStoryChange,
        itemEdit:    DinoActorSheet._onItemEdit,
        itemDelete:  DinoActorSheet._onItemDelete,
      },
    };
    static PARTS = {
      main: { template: "systems/dino-island/templates/actors/hero-sheet.html" },
    };
    _configureRenderOptions(options) {
      super._configureRenderOptions(options);
      options.parts = ["main"];
      this.constructor.PARTS.main.template = this.document.type === "npc"
        ? "systems/dino-island/templates/actors/npc-sheet.html"
        : "systems/dino-island/templates/actors/hero-sheet.html";
    }
    async _prepareContext(options) {
      const context = await super._prepareContext(options);
      const actor = this.document;
      const sys   = actor.system;
      const cls   = sys.class ?? "doctor";
      context.actor        = actor;
      context.system       = sys;
      context.config       = DINO;
      context.classLabel   = DINO.classes[cls] ?? cls;
      context.classTagline = DINO.classTaglines[cls] ?? "";
      context.classGear    = DINO.classGear[cls] ?? [];
      context.perilMoves   = DINO.perilMoves;
      context.safetyMoves  = DINO.safetyMoves;
      context.isEditable   = this.isEditable;
      const stories = DINO.classStories[cls] ?? [];
      context.stories = stories.map((text, i) => ({
        text, index: i, used: sys[`story${i}`] ?? false,
      }));
      context.moves     = actor.items.filter(i => i.type === "move");
      context.gearItems = actor.items.filter(i => i.type === "gear");
      return context;
    }
    _onRender(context, options) {
      super._onRender(context, options);
      const el = this.element;

      // Tabs
      el.querySelectorAll(".sheet-tabs .item").forEach(btn => {
        btn.addEventListener("click", ev => {
          ev.preventDefault();
          const tab = btn.dataset.tab;
          el.querySelectorAll(".sheet-tabs .item").forEach(b => b.classList.remove("active"));
          el.querySelectorAll(".sheet-body .tab").forEach(t => t.classList.remove("active"));
          btn.classList.add("active");
          el.querySelector(`.sheet-body .tab[data-tab="${tab}"]`)?.classList.add("active");
        });
      });

      // Klasse ändern → Sheet komplett neu rendern
      el.querySelector("select[name='system.class']")?.addEventListener("change", async ev => {
        await this.document.update({ "system.class": ev.currentTarget.value });
        this.render();
      });

      if (!this.isEditable) return;

      // Injury Checkboxen
      el.querySelectorAll(".injury-checkbox").forEach(cb => {
        cb.addEventListener("change", async ev => {
          await this.document.update({ [`system.injuries.${ev.currentTarget.dataset.field}`]: ev.currentTarget.checked });
        });
      });
    }
    static async _onRollMove(event, target) {
      const move = [...DINO.perilMoves, ...DINO.safetyMoves].find(m => m.key === target.dataset.move);
      if (!move) return;
      const stats = this.document.system?.stats ?? {};
      let bonus = 0, label = move.label;
      if (move.stat === "best") {
        bonus = Math.max(stats.clever?.value ?? 0, stats.fit?.value ?? 0, stats.steady?.value ?? 0);
        label += " (bester Stat)";
      } else if (move.stat === "none") {
        bonus = move.bonus ?? 0;
      } else {
        bonus = stats[move.stat]?.value ?? 0;
        label += ` (${DINO.stats[move.stat]})`;
      }
      await game.dino.rollMove(label, bonus, this.document);
    }
    static async _onStatRoll(event, target) {
      const stat = target.dataset.stat;
      await game.dino.rollMove(`${DINO.stats[stat]}-Wurf`, this.document.system?.stats?.[stat]?.value ?? 0, this.document);
    }
    static async _onStoryChange(event, target) {
      await this.document.update({ [`system.story${target.dataset.index}`]: target.checked });
    }
    static _onItemEdit(event, target) {
      this.document.items.get(target.closest("[data-item-id]")?.dataset.itemId)?.sheet.render(true);
    }
    static async _onItemDelete(event, target) {
      const item = this.document.items.get(target.closest("[data-item-id]")?.dataset.itemId);
      if (!item) return;
      const ok = await foundry.applications.api.DialogV2.confirm({
        window: { title: "Item löschen" },
        content: `<p>„${item.name}" wirklich löschen?</p>`,
      });
      if (ok) item.delete();
    }
  }

  // ---- ITEM SHEET ----
  class DinoItemSheet extends HandlebarsApplicationMixin(DocumentSheetV2) {
    static DEFAULT_OPTIONS = {
      classes: ["dino-island", "sheet", "item"],
      position: { width: 480, height: 360 },
      window: { resizable: true },
      form: { submitOnChange: true, closeOnSubmit: false },
    };
    static PARTS = {
      main: { template: "systems/dino-island/templates/actors/item-sheet.html" },
    };
    async _prepareContext(options) {
      const context      = await super._prepareContext(options);
      context.item       = this.document;
      context.system     = this.document.system;
      context.itemType   = this.document.type;
      context.isEditable = this.isEditable;
      return context;
    }
    _onRender(context, options) {
      super._onRender(context, options);
      const el = this.element;
      // Speichern-Button
      el.querySelector(".save-btn")?.addEventListener("click", async () => {
        const data = {};
        el.querySelectorAll("input, select, textarea").forEach(field => {
          if (field.name) data[field.name] = field.type === "checkbox" ? field.checked : field.value;
        });
        await this.document.update(data);
        this.close();
      });
    }
  }

  // ---- REGISTRIEREN ----
  foundry.documents.collections.Actors.registerSheet("dino-island", DinoActorSheet, {
    types: ["hero", "npc"], makeDefault: true, label: "Dino Island Charakter-Bogen",
  });
  foundry.documents.collections.Items.registerSheet("dino-island", DinoItemSheet, {
    types: ["move", "gear"], makeDefault: true, label: "Dino Island Item",
  });

  // ---- HANDLEBARS ----
  Handlebars.registerHelper("dinoSignedNum", v => { const n = parseInt(v)||0; return n>=0?`+${n}`:`${n}`; });
  Handlebars.registerHelper("dinoEq",      (a, b) => a === b);
  Handlebars.registerHelper("dinoChecked", v => v ? "checked" : "");

  console.log("DinoIsland | System bereit ✓");
});

// -------------------------------------------------------
// WÜRFELFUNKTION
// -------------------------------------------------------
export async function rollMove(label, bonus, actor) {
  const b = parseInt(bonus) || 0;
  const formula = b === 0 ? "2d6" : b > 0 ? `2d6 + ${b}` : `2d6 - ${Math.abs(b)}`;
  const roll = new Roll(formula);
  await roll.evaluate();

  const total = roll.total;
  let resultText, resultCls;
  if      (total >= 10) { resultText = "✅ Volltreffer! (10+)"; resultCls = "hit-full"; }
  else if (total >= 7)  { resultText = "⚠️ Teilerfolg (7–9)";  resultCls = "hit-partial"; }
  else                  { resultText = "❌ Fehlschlag (6-)";    resultCls = "hit-miss"; }

  const bonusTxt = b >= 0 ? `+${b}` : `${b}`;
  const content = `
    <div class="dino-roll">
      <h3 class="dino-roll-title">${label}</h3>
      <div class="dino-roll-formula">2d6 ${bonusTxt} = <strong>${total}</strong></div>
      <div class="dino-roll-result ${resultCls}">${resultText}</div>
    </div>`;

  const msgData = { speaker: ChatMessage.getSpeaker({ actor }), content, rolls: [roll] };
  const styleConst = CONST.CHAT_MESSAGE_STYLES ?? CONST.CHAT_MESSAGE_TYPES;
  if (styleConst?.ROLL !== undefined) msgData[CONST.CHAT_MESSAGE_STYLES ? "style" : "type"] = styleConst.ROLL;
  if (game.dice3d) await game.dice3d.showForRoll(roll, game.user, true);
  await ChatMessage.create(msgData);
}
