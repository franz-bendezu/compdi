import { createEsbuildPlugin } from "unplugin";
import { compdiFactory } from "./core";

export default /* #__PURE__ */ createEsbuildPlugin(compdiFactory);
