import Entity from "entitystorage";

export default class Setup extends Entity{
  initNew(){
    this.tag("wikisetup")
  }

  static lookup(){
    return Setup.find("tag:wikisetup") || new Setup()
  }

  toObj(){
    return {
      enablePublicPages: this.enablePublicPages
    }
  }
}