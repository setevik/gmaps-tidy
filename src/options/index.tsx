import { h, render } from "preact";
import { OptionsApp } from "./OptionsApp";

const root = document.getElementById("options");
if (root) {
  render(<OptionsApp />, root);
}
