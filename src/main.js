import "./styles/style.css";

import "@fontsource/anton/400.css";
import "@fontsource/work-sans/400.css";
import "@fontsource/work-sans/500.css";
import "@fontsource/work-sans/600.css";
import "@fontsource/work-sans/700.css";
import "@fontsource/ibm-plex-mono/500.css";

import { initializeBooking } from "./scripts/booking.js";
import { initializeHeaderMenu } from "./scripts/header-menu.js";
import { initializePwa } from "./scripts/pwa.js";
import { initializeServiceSelection } from "./scripts/service-selection.js";

initializeHeaderMenu();
initializeServiceSelection();
initializeBooking();
initializePwa();
