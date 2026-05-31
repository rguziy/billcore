declare module "bootstrap" {
  export class Modal {
    static getOrCreateInstance(element: Element): Modal;
    show(): void;
    hide(): void;
  }
}
