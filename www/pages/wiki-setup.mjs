const elementName = 'wiki-setup-page'

import api from "/system/api.mjs"
import "/components/field-edit.mjs"
import "/components/field-list.mjs"
import {fire, on, off} from "/system/events.mjs"
import {goto} from "/system/core.mjs"

const template = document.createElement('template');
template.innerHTML = `
  <link rel='stylesheet' href='/css/global.css'>
  <style>
    #container{
        padding: 10px;
        position: relative;
    }
    div.group:not(:first-child){
      margin-top: 10px;
    }
    .group input{
      width: 350px;
    }
    field-list{
      width: 600px;
    }
  </style>

  <div id="container">
    <h2>Setup</h2>
    <field-list labels-pct="20">
      <field-edit type="checkbox" label="Public pages" title="When enabled, all wiki pages with tag 'public' will be viewable without being signed in" id="enablePublicPages"></field-edit>
    </field-list>
  </div>
`;

class Element extends HTMLElement {
  constructor() {
    super();

    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));

    this.refreshData = this.refreshData.bind(this);

    this.refreshData();
  }

  async refreshData(){
    let setup = await api.get("wiki/setup")

    this.shadowRoot.getElementById("enablePublicPages").setAttribute("value", setup.enablePublicPages || false)

    this.shadowRoot.querySelectorAll("field-edit:not([disabled])").forEach(e => e.setAttribute("patch", `wiki/setup`));
  }

  connectedCallback() {
    on("changed-page", elementName, this.refreshData)
  }

  disconnectedCallback() {
    off("changed-page", elementName)
  }
}

window.customElements.define(elementName, Element);
export {Element, elementName as name}