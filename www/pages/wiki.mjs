const elementName = 'wiki-page'

import {state, goto, apiURL, setPageTitle} from "/system/core.mjs"
import {isSignedIn, user} from "/system/user.mjs"
import {on, off} from "/system/events.mjs"
import api from "/system/api.mjs"
import {userPermissions} from "/system/user.mjs"
import "/components/action-bar.mjs"
import "/components/action-bar-item.mjs"
import "/components/field-edit.mjs"
import "/components/field-list.mjs"
import "/components/action-bar-menu.mjs"
import "/components/acl.mjs"

import "/libs/inline-attachment.js"
import "/libs/codemirror-4.inline-attachment.js"

import "https://unpkg.com/easymde/dist/easymde.min.js"
import { promptDialog } from "../../components/dialog.mjs"
import { confirmDialog, alertDialog } from "../../components/dialog.mjs"
//import "/libs/simplemde.js"

const template = document.createElement('template');
template.innerHTML = `

  <link rel="stylesheet" href="https://unpkg.com/easymde/dist/easymde.min.css">
  <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/font-awesome/latest/css/font-awesome.min.css">
  <style>
    #container{
      padding: 10px;
    }
    .hidden{display: none;}
    #title{margin-top: 0px; margin-bottom: 5px;}
    #hint{margin-bottom: 5px;}
    .editor-toolbar{
      background: rgba(255, 255, 255, 0.4);
      opacity: 1;
    }
    
    #rendered table{border-collapse: collapse;}
    #rendered table th{text-align: left; border-bottom: 1px solid black;}
    #rendered table th, #rendered table td{padding-right: 5px;}
    #rendered table td{border-left: 1px solid gray; padding: 5px;}
    #rendered table tbody tr{vertical-align: top; border-bottom: 1px solid gray; border-right: 1px solid gray;}
    
    #options-menu h4{
      margin-bottom: 5px;
    }
    #options-menu h4:first-child{
      margin-top: 5px;
    }
    field-list{margin-bottom: 5px;}
  </style>

  <action-bar id="action-bar" class="hidden">
      <action-bar-item id="search-btn">Search</action-bar-item>
      <action-bar-item class="hidden" id="edit-btn">Edit</action-bar-item>
      <action-bar-item class="hidden" id="save-btn">Save</action-bar-item>
      <action-bar-item class="hidden" id="cancel-btn">Close editor</action-bar-item>
      
      <action-bar-item id="options-menu" class="hidden">
        <action-bar-menu label="Options">
          <h4>This page:</h4>
          <field-list labels-pct="30">
            <field-edit label="Title" type="text" id="title-edit" field="title"></field-edit>
            <field-edit label="Tags" type="text" id="tags" placeholder="tag1, tag2, ..."></field-edit>
          </field-list>
          <acl-component id="acl" rights="rw" type="wiki" disabled></acl-component>
          <button class="hidden" id="delete-btn">Delete page</button>
        </action-bar-menu>
      </action-bar-item>
  </action-bar>
    
  <div id="container">
    <h1 id="title" title="Doubleclick to change"></h1>

    <div id="editor-container" class="hidden">
      <textarea id="editor"></textarea>
      <div id="hint">Hint: Use [[page]] to link to another wiki page. Use [[/user/myuser]] to link to a user (or any other page).</div>
      <hr>
    </div>
    <div id="rendered"></div>
  </div>
`;

class Element extends HTMLElement {
  constructor() {
    super();

    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));

    this.refreshData = this.refreshData.bind(this)
    this.editClicked = this.editClicked.bind(this)
    this.cancelClicked = this.cancelClicked.bind(this)
    this.saveClicked = this.saveClicked.bind(this)
    this.titleClicked = this.titleClicked.bind(this)
    this.renderedClick = this.renderedClick.bind(this)
    this.deletePage = this.deletePage.bind(this)

    this.shadowRoot.getElementById("edit-btn").addEventListener("click", this.editClicked)
    this.shadowRoot.getElementById("cancel-btn").addEventListener("click", this.cancelClicked)
    this.shadowRoot.getElementById("save-btn").addEventListener("click", this.saveClicked)
    this.shadowRoot.getElementById("title").addEventListener("dblclick", this.titleClicked)
    this.shadowRoot.getElementById("rendered").addEventListener("click", this.renderedClick)
    this.shadowRoot.getElementById("search-btn").addEventListener("click", () => goto("/wiki-search"))
    this.shadowRoot.getElementById("delete-btn").addEventListener("click", this.deletePage)
    this.shadowRoot.getElementById("title-edit").addEventListener("value-changed", this.refreshData)
  }

  async refreshData(){

    this.pageId = /\/wiki\/([a-zA-Z]?[a-zA-Z0-9\-]+)/.exec(state().path)?.[1]
    if(this.pageId == "index-private" && isSignedIn()){
      this.pageId = `index-private-${user.id}`
    }

    if(!this.pageId){
      this.pageId = isSignedIn() ? "index" : "index-public"
    }

    setPageTitle('')
    try{
      this.page = await api.get(`wiki/${this.pageId}`)
    } catch(err){
      alertDialog("You do not have access to this page")
    }
    if(!this.page) {
      this.shadowRoot.getElementById("tags").setAttribute("patch", ``)
      this.shadowRoot.getElementById("tags").setAttribute("value", "")
      return;
    }

    setPageTitle(this.page.title)

    this.shadowRoot.getElementById("title").innerText = this.page.title
    this.shadowRoot.getElementById("rendered").innerHTML = this.page.html||""
    this.shadowRoot.getElementById("title-edit").setAttribute("value", this.page.title)
    this.shadowRoot.getElementById("tags").setAttribute("value", this.page.tags.join(", "))

    this.shadowRoot.querySelectorAll("field-edit:not([disabled]):not(.my)").forEach(e => e.setAttribute("patch", `wiki/${this.pageId}`));
    
    if(this.page.exists && this.page.rights.includes("w")){
      this.shadowRoot.getElementById("acl").setAttribute("entity-id", this.pageId)
      setTimeout(() => this.shadowRoot.getElementById("acl").removeAttribute("disabled"), 500)
    }

    let permissions = await userPermissions()

    if(permissions.includes("wiki.read")){
      this.shadowRoot.getElementById("action-bar").classList.remove("hidden")
    }
    if(permissions.includes("wiki.edit") && this.page.rights.includes("w")){
      this.shadowRoot.getElementById("edit-btn").classList.remove("hidden")
      this.shadowRoot.getElementById("delete-btn").classList.remove("hidden")
      this.shadowRoot.getElementById("options-menu").classList.remove("hidden")
    }
  }

  editClicked(){
    if(this.isEditMode)
      this.setViewMode();
    else
      this.setEditMode();
  }

  cancelClicked(){
    this.setViewMode()
  }

  async saveClicked(){
    await api.patch(`wiki/${this.pageId}`, {body: this.simplemde.value()})
    this.refreshData();
  }

  async titleClicked(){
    let newTitle = await promptDialog("Enter new title", this.page.title)
    if(!newTitle) return;
    await api.patch(`wiki/${this.pageId}`, {title: newTitle})
    this.refreshData();
  }

  async setEditMode(){
    this.shadowRoot.getElementById("editor-container").classList.remove("hidden")
    this.shadowRoot.getElementById("edit-btn").classList.add("hidden")
    this.shadowRoot.getElementById("save-btn").classList.remove("hidden")
    this.shadowRoot.getElementById("cancel-btn").classList.remove("hidden")

    if(!this.simplemde){
      this.simplemde = new EasyMDE({
        element: this.shadowRoot.getElementById("editor"),
        spellChecker: false,
        showIcons: ["code", "table"]
      });
      inlineAttachment.editors.codemirror4.attach(this.simplemde.codemirror, {
        uploadUrl: `${apiURL()}/wiki/${this.pageId}/attach-image`,
        extraHeaders: api.getHeaders(),
        jsonFieldName: "hash",
        urlText: "![image](/img/{filename})"
      })
    }
    this.simplemde.value(this.page.body)

    this.isEditMode = true;
  }

  setViewMode(){
    this.shadowRoot.getElementById("editor-container").classList.add("hidden")
    this.shadowRoot.getElementById("edit-btn").classList.remove("hidden")
    this.shadowRoot.getElementById("save-btn").classList.add("hidden")
    this.shadowRoot.getElementById("cancel-btn").classList.add("hidden")

    this.isEditMode = false;
  }

  renderedClick(e){
    if(e.target.tagName == "A"){
      let href = e.target.getAttribute("href")
      if(href.startsWith("/")){
        e.preventDefault();
        goto(href)
      }
    }
  }

  async deletePage(){
    if(!await confirmDialog(`Are you sure that you want to delete wiki page ${this.pageId}`)) return;
    await api.del(`wiki/${this.pageId}`)
    window.history.back();
  }

  connectedCallback() {
    on("logged-in", elementName, this.refreshData)
    on("logged-out", elementName, this.refreshData)
    on("changed-page", elementName, this.refreshData)
  }

  disconnectedCallback() {
    off("changed-page", elementName)
    off("logged-in", elementName)
    off("logged-out", elementName)
  }

}

window.customElements.define(elementName, Element);
export {Element, elementName as name}