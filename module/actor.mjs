export class DinoIslandActor extends Actor {
  async _preCreate(data, options, user) {
    await super._preCreate(data, options, user);
    if (data.type === "hero") {
      this.updateSource({
        "prototypeToken.actorLink": true,
        "prototypeToken.disposition": CONST.TOKEN_DISPOSITIONS.FRIENDLY,
        "prototypeToken.displayName": CONST.TOKEN_DISPLAY_MODES.HOVER,
      });
    }
  }
}
