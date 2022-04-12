const elementName = 'wiki-page'

import {state, goto, apiURL, setPageTitle} from "/system/core.mjs"
import {isSignedIn, user} from "/system/user.mjs"
import {on, off, fire} from "/system/events.mjs"
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
import { confirmDialog, alertDialog, showDialog, promptDialog } from "/components/dialog.mjs"
import { toggleInRightbar } from "/pages/rightbar/rightbar.mjs"
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
    #title-container{margin-top: 0px; margin-bottom: 5px;}
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
    #revisions{margin-top: 8px; cursor: pointer;}
    #revision-info{
      font-size: 50%;
      color: gray;
      vertical-align: middle;
    }
    acl-component{margin-bottom: 5px; display: block;}
  </style>

  <action-bar id="action-bar" class="hidden">
    <action-bar-item id="new-btn">New</action-bar-item>
    <action-bar-item id="search-btn">Search</action-bar-item>
    <action-bar-item class="hidden" id="edit-btn">Edit</action-bar-item>
    <action-bar-item class="hidden" id="back-to-active-btn">Go back to active revision</action-bar-item>
    
    <action-bar-item id="options-menu" class="hidden">
      <action-bar-menu label="Options">
        <h4>This page:</h4>
        <field-list labels-pct="30">
          <field-edit label="Title" type="text" id="title-edit" field="title"></field-edit>
          <field-edit label="Tags" type="text" id="tags" placeholder="tag1, tag2, ..."></field-edit>
        </field-list>
        <acl-component id="acl" rights="rw" type="wiki" disabled></acl-component>
        <button class="hidden" id="delete-btn">Delete page</button>
        <button id="copy-link-btn">Copy page link</button>
        <div tabindex="0" id="revisions"></div>
      </action-bar-menu>
    </action-bar-item>
  </action-bar>
    
  <div id="container">
    <h1 id="title-container"><span id="title" title="Doubleclick to change"></span><span id="revision-info"></span></h1>

    <div id="editor-container" class="hidden">
      <textarea id="editor"></textarea>
      <div id="hint">Hint: Use [[page]] to link to another wiki page. Use [[/user/myuser]] to link to a user (or any other page).</div>
      <hr>
    </div>
    <div id="rendered"></div>
  </div>

  <dialog-component title="New page" id="new-dialog">
    <field-component label="Title"><input id="new-title"></input></field-component>
    <field-component label="Id"><input id="new-id"></input></field-component>
    <field-component label="Tags"><input id="new-tags" placeholder="tag1, tag2, ..."></input></field-component>
  </dialog-component>
`;

class Element extends HTMLElement {
  constructor() {
    super();

    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));

    this.refreshData = this.refreshData.bind(this)
    this.newClicked = this.newClicked.bind(this)
    this.editClicked = this.editClicked.bind(this)
    this.cancelClicked = this.cancelClicked.bind(this)
    this.saveClicked = this.saveClicked.bind(this)
    this.titleClicked = this.titleClicked.bind(this)
    this.renderedClick = this.renderedClick.bind(this)
    this.deletePage = this.deletePage.bind(this)
    this.showRevisions = this.showRevisions.bind(this)

    this.shadowRoot.getElementById("edit-btn").addEventListener("click", this.editClicked)
    this.shadowRoot.getElementById("new-btn").addEventListener("click", this.newClicked)
    //this.shadowRoot.getElementById("cancel-btn").addEventListener("click", this.cancelClicked)
    //this.shadowRoot.getElementById("save-btn").addEventListener("click", this.saveClicked)
    this.shadowRoot.getElementById("title").addEventListener("dblclick", this.titleClicked)
    this.shadowRoot.getElementById("rendered").addEventListener("click", this.renderedClick)
    this.shadowRoot.getElementById("search-btn").addEventListener("click", () => goto("/wiki-search"))
    this.shadowRoot.getElementById("delete-btn").addEventListener("click", this.deletePage)
    this.shadowRoot.getElementById("revisions").addEventListener("click", this.showRevisions)
    this.shadowRoot.getElementById("title-edit").addEventListener("value-changed", this.refreshData)
    this.shadowRoot.getElementById("back-to-active-btn").addEventListener("click", () => goto(`/wiki/${this.pageId}`))
    this.shadowRoot.getElementById("new-title").addEventListener("input", e => {
      if(!e.originalTarget.value) return this.shadowRoot.getElementById("new-id").value = '';
      clearTimeout(this.slugGenTimer)
      this.slugGenTimer = setTimeout(() => {
        api.post("wiki/generate-id", {id: e.originalTarget.value, ensureNew: true}).then(id => this.shadowRoot.getElementById("new-id").value = id)
      }, 400)
    })
    this.shadowRoot.getElementById("copy-link-btn").addEventListener("click", () => {
      navigator.clipboard.writeText(`[[${this.pageId}]]`)
    })
  }

  async refreshData(){
    this.pageId = getPageIdFromPath()

    setPageTitle('')
    try{
      this.page = await api.get(`wiki/${this.pageId}?revision=${state().query.revision||""}`)
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
    this.shadowRoot.getElementById("revision-info").innerText = this.page.revisionId ? ` (revision ${this.page.modified?.replace("T", " ").substring(0, 19)||"N/A"})` : ''
    this.shadowRoot.getElementById("back-to-active-btn").classList.toggle("hidden", !this.page.revisionId)
    
    let permissions = await userPermissions()
    let edit = permissions.includes("wiki.edit") && this.page.rights.includes("w")
    let read = permissions.includes("wiki.read")

    if(this.page.revisionId){
    } else {
      this.shadowRoot.querySelectorAll("field-edit:not([disabled]):not(.my)").forEach(e => e.setAttribute("patch", `wiki/${this.pageId}`));
      this.shadowRoot.getElementById("revisions").innerText = `${this.page.revisions.length} previous revision(s)`

      let allowEditACL = this.page.exists && this.page.rights.includes("w")
      this.shadowRoot.getElementById("acl").setAttribute("entity-id", allowEditACL ? this.pageId : "")
      setTimeout(() => this.shadowRoot.getElementById("acl").toggleAttribute("disabled", !allowEditACL), 500)
    }
      
    this.shadowRoot.getElementById("edit-btn").classList.toggle("hidden", !edit || this.page.revisionId)
    this.shadowRoot.getElementById("delete-btn").classList.toggle("hidden", !edit || this.page.revisionId)
    this.shadowRoot.getElementById("options-menu").classList.toggle("hidden", !edit || this.page.revisionId)
    this.shadowRoot.getElementById("action-bar").classList.toggle("hidden", !read)
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
    fire("current-wiki-page-updated")
  }

  async titleClicked(){
    let newTitle = await promptDialog("Enter new title", this.page.title)
    if(!newTitle) return;
    await api.patch(`wiki/${this.pageId}`, {title: newTitle})
    this.refreshData();
  }

  async setEditMode(){
    this.shadowRoot.getElementById("editor-container").classList.remove("hidden")
    //this.shadowRoot.getElementById("edit-btn").classList.add("hidden")
    //this.shadowRoot.getElementById("save-btn").classList.remove("hidden")
    //this.shadowRoot.getElementById("cancel-btn").classList.remove("hidden")

    if(!this.simplemde){
      this.simplemde = new EasyMDE({
        element: this.shadowRoot.getElementById("editor"),
        spellChecker: false,
        //showIcons: ["code", "table"]
        toolbar: [
          {
              name: "save",
              action: () => this.saveClicked(),
              className: "fa fa-save",
              title: "Save",
          },
          {
            name: "close",
            action: () => this.editClicked(),
            className: "fa fa-close",
            title: "Close",
          },
          "|", "bold", "italic", "heading", "|", "code", "quote", "unordered-list", "ordered-list", "|", "link", "image", "table", "|", "preview", "side-by-side", "fullscreen"
        ]
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
    //this.shadowRoot.getElementById("edit-btn").classList.remove("hidden")
    //this.shadowRoot.getElementById("save-btn").classList.add("hidden")
    //this.shadowRoot.getElementById("cancel-btn").classList.add("hidden")

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

  showRevisions(){
    toggleInRightbar("wiki-revisions")
  }

  newClicked(){
    let dialog = this.shadowRoot.querySelector("#new-dialog")

    showDialog(dialog, {
      show: () => this.shadowRoot.querySelector("#new-title").focus(),
      ok: async (val) => {
        let exists = await api.get(`wiki/exists?id=${val.id}`)
        if(exists) return alertDialog(`The page ${val.id} already exists`)
        await api.patch(`wiki/${val.id}`, val)
        goto(`/wiki/${val.id}`)
      },
      validate: (val) => 
          !val.title ? "Please fill out title"
        : !val.id ? "Please fill out id"
        : true,
      values: () => {return {
        title: this.shadowRoot.getElementById("new-title").value,
        id: this.shadowRoot.getElementById("new-id").value,
        tags: [...new Set(this.shadowRoot.getElementById("new-tags").value.split(",").map(t => t.trim()).filter(t => t))]
      }},
      close: () => {
        this.shadowRoot.querySelectorAll("field-component input").forEach(e => e.value = '')
      }
    })
  }

  connectedCallback() {
    on("logged-in", elementName, this.refreshData)
    on("logged-out", elementName, this.refreshData)
    on("changed-page", elementName, this.refreshData)
    on("changed-page-query", elementName, this.refreshData)
  }

  disconnectedCallback() {
    off("changed-page", elementName)
    off("logged-in", elementName)
    off("logged-out", elementName)
    off("changed-page-query", elementName)
  }
}

window.customElements.define(elementName, Element);
export {Element, elementName as name}

export let getPageIdFromPath = () => {
  let pageId = /\/wiki\/([a-zA-Z]?[a-zA-Z0-9\-]+)/.exec(state().path)?.[1]
  if(pageId == "index-private" && isSignedIn()){
    pageId = `index-private-${user.id}`
  }

  if(!pageId){
    pageId = isSignedIn() ? "index" : "index-public"
  }

  return pageId
}