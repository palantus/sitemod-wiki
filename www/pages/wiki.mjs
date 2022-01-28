const elementName = 'wiki-page'

import {state, goto, apiURL} from "/system/core.mjs"
import {on, off} from "/system/events.mjs"
import {default as api, userPermissions} from "/system/api.mjs"
import "/components/action-bar.mjs"
import "/components/action-bar-item.mjs"
import "/components/field-edit.mjs"

import "/libs/inline-attachment.js"
import "/libs/codemirror-4.inline-attachment.js"

import "https://cdn.jsdelivr.net/simplemde/latest/simplemde.min.js"
import { promptDialog } from "../../components/dialog.mjs"
import { confirmDialog } from "../../components/dialog.mjs"
//import "/libs/simplemde.js"

const template = document.createElement('template');
template.innerHTML = `

  <link rel="stylesheet" href="https://cdn.jsdelivr.net/simplemde/latest/simplemde.min.css">
  <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/font-awesome/latest/css/font-awesome.min.css">
  <style>
    #container{
      padding: 10px;
    }
    .hidden{display: none;}
    #title{margin-top: 0px;}
    #hint{margin-bottom: 5px;}
    .editor-toolbar{
      background: rgba(255, 255, 255, 0.4);
      opacity: 1;
    }
    #tag-container{border-left: 1px solid gray; margin-left: 10px; padding-left: 20px;}
    
    #rendered table{border-collapse: collapse;}
    #rendered table th{text-align: left; border-bottom: 1px solid black;}
    #rendered table th, #rendered table td{padding-right: 5px;}
    #rendered table td{border-left: 1px solid gray; padding: 5px;}
    #rendered table tbody tr{vertical-align: top; border-bottom: 1px solid gray; border-right: 1px solid gray;}
    
  </style>

  <action-bar>
      <action-bar-item class="hidden" id="edit-btn">Edit</action-bar-item>
      <action-bar-item class="hidden" id="save-btn">Save</action-bar-item>
      <action-bar-item class="hidden" id="cancel-btn">Close editor</action-bar-item>
      <action-bar-item id="search-btn">Search</action-bar-item>
      <action-bar-item class="hidden" id="delete-btn">Delete</action-bar-item>
      
      <span id="tag-container" class="hidden">
        <label for="tags">Tags:</label>
        <field-edit type="text" id="tags" placeholder="tag1, tag2, ..."></field-edit>
      </span>
  </action-bar>
    
  <div id="container">
    <h1 id="title" title="Doubleclick to change"></h1>

    <div id="editor-container" class="hidden">
      <div id="hint">Hint: Use [[page]] to link to another wiki page. Use [[/issue/1234]] to link to an issue (or any other AXM page).</div>
      <textarea id="editor"></textarea>
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

    this.pageId = /\/wiki\/([a-zA-Z]?[a-zA-Z0-9\-]+)/.exec(state().path)?.[1] || "index"

    userPermissions().then(permissions => {
      if(permissions.includes("wiki.edit")){
        this.shadowRoot.getElementById("edit-btn").classList.remove("hidden")
        this.shadowRoot.getElementById("delete-btn").classList.remove("hidden")
        this.shadowRoot.getElementById("tag-container").classList.remove("hidden")
      }
    })
  }

  async refreshData(){
    this.page = await api.get(`wiki/${this.pageId}`)
    if(!this.page) {
      this.shadowRoot.getElementById("tags").setAttribute("patch", ``)
      this.shadowRoot.getElementById("tags").setAttribute("value", "")
      return;
    }

    this.shadowRoot.getElementById("title").innerText = this.page.title
    this.shadowRoot.getElementById("rendered").innerHTML = this.page.html||""
    this.shadowRoot.getElementById("tags").setAttribute("value", this.page.tags.join(", "))
    this.shadowRoot.getElementById("tags").setAttribute("patch", `wiki/${this.pageId}`)
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
      this.simplemde = new SimpleMDE({
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
    on("changed-project", elementName, this.refreshData)
    on("changed-page", elementName, this.refreshData)
    this.refreshData();
  }

  disconnectedCallback() {
    off("changed-project", elementName, this.refreshData)
    off("changed-page", elementName, this.refreshData)
  }

}

window.customElements.define(elementName, Element);
export {Element, elementName as name}