/// <reference types="vite/client" />

declare module "*.gs?raw" {
  const content: string;
  export default content;
}

declare module "*.json?raw" {
  const content: string;
  export default content;
}
