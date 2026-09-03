import { generateOutput, showModelSelector, switchModel } from './ai.js';
import { store } from './state.js';

const pageLoadTime = Date.now();

const ANSI_RESET = '\x1b[0m';
const ANSI_BOLD = '\x1b[1m';
function ansiRGB(r, g, b) { return `\x1b[38;2;${r};${g};${b}m`; }
function ansiBgRGB(r, g, b) { return `\x1b[48;2;${r};${g};${b}m`; }
const SITE_BLUE = ansiRGB(80, 140, 250);
const SITE_RED = ansiRGB(220, 80, 100);
const SITE_GREEN = ansiRGB(60, 200, 120);
const SITE_CYAN = ansiRGB(60, 190, 220);
const SITE_WHITE = ansiRGB(220, 220, 230);
const SITE_MUTED = ansiRGB(140, 140, 155);
const SITE_FAINT = ansiRGB(100, 100, 115);
const SITE_OK = ansiRGB(60, 200, 120);
const SITE_ERR = ansiRGB(220, 80, 100);
const SITE_LABEL = ansiRGB(80, 140, 250);

const ASCII_ART = [
  `⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⠀⠀⢀⠀⠀⡀⠀⢀⠀⠀⡀⠀⢀⠀⠀⡀⠀⢀⠀⠀⡀⠀⢀⠀⠀⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀`,
  `⠀⠀⠐⠀⠁⠀⡈⠀⠈⠀⠈⠀⠈⢀⠈⠀⠈⠀⠁⠈⠀⠀⠈⠀⠀⠄⠀⠐⠀⠀⠂⠀⠐⠀⠀⠂⠀⠐⠀⠀⠄⠀⠐⠀⠀⠄⠀⡀⠁⠈⠀⠁⠈⠀⠁⠈⠀⠈⢀⠈⠀⠈⠀⠈⠀⡀⠁⠀⠂⠁⠀⠐⠀⠐⠀⠀⠂⠀⠠⠀⠠⠀⠠⠀⠀⡀⠀⡀⠀⠀⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀`,
  `⠀⠈⠀⠀⠂⠁⠀⠀⡈⠀⠈⠀⠁⠀⢀⠈⠀⠁⠀⠁⡀⠁⠈⢀⠐⠀⠈⡀⠄⠁⢀⠈⠀⠄⠁⢀⠈⠀⠄⠁⢀⠈⠀⠈⢀⠠⠀⠠⠀⠁⠀⠁⡀⠁⢀⠈⠀⠈⠀⠀⡀⠁⠀⠁⢀⠀⠀⠂⠀⠄⠂⠀⠂⠀⠐⠀⠐⠀⢀⠀⢀⠀⢀⠀⠀⠀⠀⠀⠀⡀⠀⠀⠀⠁⠀⠐⠀⠀⠂⠀⠀⡀⠀⠀⠀⠀`,
  `⠀⢀⠈⠀⠠⠀⠂⠁⠀⠀⠁⠀⠁⡀⠄⠀⠄⠁⠈⠀⢀⠀⠁⠀⡀⠄⠁⠀⢀⠠⠀⠀⠂⠀⠂⢀⠀⠂⢀⠐⠀⢀⠈⢀⠀⠀⠀⠀⠀⠈⠀⠁⠀⠀⠀⡀⠈⠀⠈⠀⠀⡀⠁⠀⠄⠀⠂⠀⠂⠀⠀⠄⠐⠀⠐⠀⠠⠀⠀⠀⠀⠀⠀⠀⠈⠀⠀⠁⠀⠀⠀⠀⠁⠀⠀⡀⠀⢀⠀⠀⠀⠀⠀⠈⠀⠀`,
  `⠀⠀⠀⠐⠀⠀⠄⠀⠐⠈⠀⠈⠀⠀⢀⠠⠀⠐⠀⠁⠀⡀⠈⢀⠀⠀⠄⠈⠀⠀⡀⠁⡀⠁⠠⠀⠀⠂⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠀⠈⠀⠀⠀⠂⠀⠄⠐⠀⠐⠈⠀⠀⡀⠄⠀⠄⠀⡀⠈⠀⠈⠀⠈⠀⠀⠂⠀⠂⠀⠐⠀⠁⠀⠀⠄⠀⠀⠀⠀⠀⠂⠀⠀⡀⠀⠀`,
  `⠀⠀⠁⠀⠂⠁⠀⢀⠁⠀⠄⠁⠀⠁⠀⢀⠠⠐⠀⠈⠀⡀⠐⠀⠀⠂⠀⠂⠁⢀⠀⠄⠀⠐⠀⢀⠁⠀⠀⠀⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠁⠀⠄⠀⠄⠐⠀⢀⠐⠀⠀⠀⢀⠀⢀⠀⠀⠐⠀⠐⠀⠐⠀⠀⠄⠀⠀⠄⠀⠀⢀⠀⠀⠀⠀⠄⠀⢀⠀⠀⠀⠀⠀⠀`,
  `⠀⠀⠁⠀⠄⠀⠈⠀⠀⠠⠀⠐⠈⠀⠈⠀⠀⢀⠀⠁⡀⠀⠄⠂⠁⢀⠈⠀⠐⠀⢀⠠⠀⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⠠⠀⠀⡀⠠⠀⠁⠀⠀⠀⠀⠐⠀⠠⠀⠠⠀⠠⠀⠀⠠⠀⠀⠀⠄⠀⠀⠀⠈⠀⠀⠀⠀⠀⠀⠐⠀⠀⠀`,
  `⠀⠀⠁⠀⠄⠈⠀⡀⠁⢀⠀⠂⠀⠂⠁⢀⠈⠀⠀⠄⠀⠄⠀⠄⠐⠀⢀⠈⢀⠐⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⡀⠄⠀⠂⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⡀⠀⢀⠀⠀⠂⠈⠀⠈⠀⠀⡀⠀⡀⠀⠀⡀⠠⠀⠀⠀⠂⠀⠀⠀⠈⠀⠀⢀⠠⠀⠀⠄⠀⠀⠀⠀`,
  `⠀⠀⠁⢀⠠⠀⠂⠀⢀⠀⡀⠄⠂⠀⠂⠀⠀⠄⠁⠀⠄⠐⠀⠠⠀⠂⠀⠠⠀⠀⠄⠂⠀⠀⠂⠁⠀⠀⠀⠠⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⠀⢀⠐⠀⠠⠐⠀⠀⠁⠀⠀⠀⠀⠁⠀⠀⠀⠀⠁⠀⠀⠀⠁⠀⠀⠄⠀⠀⠀⠀⠀⠀⠀⠁⠀`,
  `⠀⠀⠁⠀⠀⠀⡀⠄⠀⢀⠀⠀⡀⠄⠂⠈⠀⡀⠐⠀⠠⠀⠂⠀⠄⠂⠁⠀⠐⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠂⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⠀⠀⠀⡀⠀⢀⠀⠐⠀⠀⠂⠈⠀⠀⡀⠄⠐⠀⠀⠄⠈⠀⠀⠠⠀⠀⠀⠀⠀⢀⠠⠀⠀⢀⠀`,
  `⠀⠀⠁⠀⠂⠁⠀⠀⠠⠀⠀⠄⠀⠀⡀⠄⠂⠀⠀⠂⠀⠄⠂⠀⠄⠀⠐⠈⠀⠈⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⠠⠐⠀⡈⠀⠄⢀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠀⠀⢀⠀⠀⠠⠐⠀⠀⠠⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⠠⠀⠀⠀⠀⠂⠁⠀⠀⠀⠀⠀⠀⠀`,
  `⠀⠀⠁⢀⠠⠀⠀⠂⠀⡀⠂⠀⡀⠁⠀⠀⢀⠀⠁⠀⠂⠀⡀⠂⠀⡈⠀⠄⠂⠁⠀⠀⠀⠀⠀⠀⠀⠀⠐⠈⠀⠀⠀⠀⠀⠀⢀⠀⠄⠐⠀⡁⠄⡀⢂⠁⠄⠂⠠⠀⡀⠂⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠀⠀⠂⠀⠀⠐⠀⠀⠀⠄⠀⠠⠀⠁⠀⠀⠂⠁⠀⠈⠀⠀⠀⠀⠈⠀⠀⠀⠀⠀⠀⠀⠀⠀`,
  `⠀⠀⠈⠀⠀⠀⠐⠀⡀⠀⡀⠄⠀⠠⠐⠈⠀⠀⠈⢀⠀⠁⠀⡀⠄⠀⡀⠄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⠈⡀⡀⠄⡠⠠⡁⡂⠢⠨⡐⠠⠁⠌⠀⠂⢀⠠⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠁⠀⠄⠂⠀⠂⠀⠐⠀⠀⡀⠀⡀⠀⠄⠂⠀⠀⠀⡀⠀⠀⠀⢀⠀⠀⡀⠀⢀⠀⠀⠄⠂⠀`,
  `⠀⠀⠁⠀⠠⠈⠀⠀⡀⠀⠀⢀⠠⠀⢀⠀⠄⠈⠀⡀⠀⠂⠁⠀⠀⡀⠀⡀⠀⠁⠀⠀⠀⠀⠀⢀⢀⢄⢠⢠⡢⡲⡱⡱⡱⡸⡸⡨⡪⡢⡒⡌⡪⠨⡂⠅⠅⠨⠀⡁⢀⠀⠄⠈⠀⠀⠀⠀⠀⠀⠀⠈⠀⢀⠀⠀⡀⠠⠀⠠⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠄⠀⠀⠈⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀`,
  `⠀⠀⠂⠁⠀⢀⠀⠁⠀⠀⠁⠀⠀⢀⠀⠀⡀⠄⠂⠀⠠⠐⠀⠀⠁⠀⢀⠀⠠⠀⠀⠀⠀⠅⡊⡢⡑⡜⡜⡼⣜⢮⡳⣝⢮⡺⡸⣜⢜⡜⣜⢜⢜⢌⢪⢨⠨⠨⠠⠠⠀⠠⠀⠠⠀⠀⠀⠀⠀⠀⠀⠐⠈⠀⠀⠀⠀⠀⠀⢀⠀⠈⠀⠀⠁⠀⠐⠀⠈⠀⠀⠀⢀⠠⠀⠀⠀⠄⠀⢀⠀⠀⡀⠀⠀⠀`,
  `⠀⠀⡀⠄⠀⡀⠀⠄⠂⠁⠀⠂⠁⠀⠀⡀⠀⠀⡀⠄⠀⠄⠀⠁⠀⠁⠀⢀⠀⠀⠀⠀⠨⡐⡐⡌⡎⡪⠪⠺⠸⠕⢯⢺⢕⢽⢱⡣⡳⡹⡜⡪⠪⠘⠐⠁⠁⠁⠁⠀⠁⠐⢀⠠⠀⠂⠀⠀⠀⠀⠀⢀⠀⠀⠄⠈⠀⠈⠀⠀⠀⠀⠂⠀⠂⠀⢀⠀⢀⠀⠠⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀`,
  `⠀⠀⠀⠀⠀⠀⢀⠀⠀⡀⠄⠀⠄⠀⠁⠀⠀⠁⠀⠀⡀⠄⠀⠁⠀⠁⠠⠀⠠⠀⠀⠀⠅⡂⠂⠁⠂⡀⠂⠀⠀⠀⠀⢀⠁⡃⠣⡣⡣⠣⡑⢈⠠⠐⠀⠀⢀⠀⡀⡀⠈⠀⠀⠀⠀⠠⠀⠀⠀⠀⠀⠀⠀⡀⠀⡀⠄⠐⠀⠀⠁⠀⡀⠄⠀⢀⠀⠀⠀⠀⠀⠀⠀⢀⠀⠄⠈⠀⠀⠠⠀⠀⠀⠄⠈⠀`,
  `⠀⠀⠂⠁⠀⠁⠀⠀⢀⠀⠀⢀⠠⠐⠀⠈⠀⠐⠀⠁⠀⠀⠀⠁⠈⠀⠠⠀⠠⠀⠀⠀⠕⠠⠀⡁⢑⠐⡁⠡⠁⠌⠠⠀⠄⠐⡐⢌⢎⢂⠐⠀⠀⢀⠠⠈⢀⠠⠀⠄⠠⠀⠄⠀⡀⠀⠀⠀⠀⠀⠀⠀⠁⠀⠀⠀⠀⠀⠀⡀⠂⠀⠀⠀⠀⠀⠀⠀⠄⠀⠐⠀⠈⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀`,
  `⠀⠀⡀⠠⠀⠐⠀⠈⠀⠀⢀⠀⠀⠀⡀⠄⠁⠀⠄⠂⠀⠈⠀⠈⠀⠐⠀⠀⠄⠀⠀⠁⠀⠢⡣⢊⠊⠨⠈⠘⠐⠀⠂⠀⠄⡀⠈⠈⠈⠀⠀⠐⠈⠀⠠⠈⠀⠀⠀⠀⠁⠀⠀⡀⢀⠀⠠⠀⠀⠠⠀⠂⠀⠄⠂⠀⠐⠀⠁⠀⠀⠀⠠⠀⠂⠀⠐⠀⠀⠀⢀⠀⠀⠀⠀⠀⠀⠀⠐⠀⠀⠁⠀⠀⠄⠀`,
  `⠀⠀⠀⠀⠀⡀⠄⠀⠐⠀⠀⢀⠀⠁⠀⠀⠀⠄⠀⠠⠀⠁⠀⠁⠀⠂⠀⠁⠀⡐⠡⠀⠂⠨⡐⠠⠀⡀⠐⠠⠀⡀⠐⢀⢐⠨⠀⢠⠢⡀⠀⢈⠀⢁⠈⠐⠀⠄⠂⠀⠀⠠⠀⠠⠀⠀⡀⠀⠀⠠⠀⠀⡀⠀⠀⢀⠀⢀⠀⠀⡀⠄⠀⠀⠀⠀⡀⠀⢀⠈⠀⠀⠀⠐⠀⠀⠂⠁⠀⠀⠀⠀⠀⠀⠀⠀`,
  `⠀⠀⠐⠈⠀⠀⠀⠀⠐⠀⠈⠀⠀⠠⠐⠀⠠⠀⠐⠀⠀⠄⠁⠀⠁⠀⠄⠁⠀⡂⠀⢂⠀⡑⠌⠄⠅⢄⠨⡀⠡⠠⡨⡢⡢⡑⠀⡎⣇⠪⠀⠀⢐⠠⠨⢐⢀⢂⠄⡂⠅⡂⡈⠄⢈⠀⢀⠠⠀⠀⠂⠀⢀⠀⠈⠀⠀⠀⠀⠀⠀⠀⠀⢀⠈⠀⠀⠀⠀⠀⠀⠀⠀⢀⠀⠀⠀⠀⠀⠀⠀⠈⠀⠀⢀⠀`,
  `⠀⠀⠄⠀⢀⠠⠀⠁⠀⠠⠀⠂⠀⡀⠀⠠⠀⠠⠀⠂⠀⠠⠀⠂⠁⠀⡀⠄⠂⠅⡀⠢⡀⠪⡪⡱⡱⣑⢕⢌⢪⠪⡊⡎⡪⠂⡸⣜⢼⢨⠂⠄⠀⠂⢅⢕⢌⢆⢇⢎⠢⡂⡂⢐⠀⠠⠀⠀⠀⠀⠂⠈⠀⠀⡀⠄⠀⠠⠐⠀⠀⠂⠀⠀⠀⠀⠀⡀⠄⠀⠠⠐⠈⠀⠀⠀⠠⠀⠀⠐⠈⠀⠀⠀⠀⠀`,
  `⠀⠀⠀⡀⠀⠀⠀⢀⠐⠀⠀⢀⠀⠀⠠⠀⢀⠀⢀⠠⠐⠀⠀⡀⠠⠀⠀⠀⠀⡑⡐⡐⢌⢄⠣⢪⡪⣞⣜⢎⢎⢎⢪⠸⢈⢔⢝⢮⢳⠱⠡⠁⠄⡈⠐⠐⠱⠱⠱⠱⠑⠂⠊⠀⠐⠀⠠⠐⠀⠀⠁⠀⠐⠀⠀⠀⠀⠀⠀⠀⠀⡀⠠⠐⠀⠀⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀`,
  `⠀⠀⡀⠀⠀⠐⠈⠀⠀⠀⠠⠀⠀⠐⠀⠀⡀⠀⠀⠀⠀⢀⠀⠀⠀⡀⠀⠁⠀⠰⠨⡂⠢⡑⢕⠤⡌⣌⢈⢁⠁⠁⡀⠄⡃⠃⠐⢈⠂⠁⠁⠀⠀⠀⢀⠠⠀⠀⠂⢂⠢⠡⠈⠄⠁⠠⠀⠀⢀⠐⠀⠁⢀⠠⠀⠐⠀⠁⠀⠀⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⠀⠀⠀⠀⡀⠄⠀⠂⠀⠀⠄⠀⠐⠈⠀`,
  `⠀⠀⠀⠀⠈⠀⠀⠀⡀⠄⠀⠠⠐⠀⠀⠂⠀⠀⠈⠀⠠⠀⠀⠈⠀⠀⠀⠈⠀⢸⢨⠢⢁⠪⠨⠪⠪⠪⠨⠀⢐⢐⢌⢪⠢⡡⠡⡂⡐⢀⠐⢀⠀⡁⠠⠀⡈⢀⠁⢀⠀⡁⠁⠐⠈⠀⠀⠀⢀⠀⠁⢀⠀⠀⠀⠀⠀⠀⡀⠄⠀⠀⠀⢀⠀⠄⠈⠀⠀⠈⠀⠀⠀⠈⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀`,
  `⠀⠀⠀⠁⠀⠐⠀⠁⠀⠀⠀⢀⠀⠀⠠⠀⢀⠈⠀⠠⠀⠀⠐⠀⠐⠈⠀⠈⠀⠀⠣⢃⠂⠌⠌⠌⢌⠂⠀⡐⠐⠔⡌⢆⠇⢎⢎⠢⢂⠢⠨⠀⠂⠐⠀⠂⠀⠀⠀⡀⠄⡂⠌⠀⠠⠀⠂⠁⠀⠀⠈⠀⠀⠀⠐⠈⠀⠀⠀⠀⠀⠈⠀⠀⠀⠀⠀⠀⠀⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⡀⠄⠀⠀⠀⠀`,
  `⠀⠀⠈⠀⠀⠄⠀⢀⠀⠠⠐⠀⠀⠠⠀⠀⡀⠀⠀⠄⠀⠈⠀⠀⠄⠀⠠⠐⠀⠁⠀⠀⡀⠅⢅⢑⠐⢅⢂⢂⢂⠄⡀⠠⡨⡠⣄⣌⣄⢄⣄⢆⢆⠔⠀⡀⠀⠄⠁⠄⠂⠐⠀⠐⠀⠀⠀⢀⠠⠀⠂⠀⠀⠈⠀⠀⠀⠀⠄⠀⠠⠀⠀⡀⠀⢀⠀⠠⠀⠀⠀⠀⠁⠀⠈⠀⠀⠀⠠⠀⠀⠀⠀⠀⠐⠀`,
  `⠀⠀⠀⠂⠀⢀⠀⠀⠀⠀⠀⠀⢀⠀⠀⠄⠀⠀⠄⠀⠀⠂⠈⠀⠀⡀⠄⠀⠀⡀⠀⠁⠀⢈⠐⠄⠅⡂⡂⡂⡢⢣⠢⡂⠌⠪⡑⡕⡓⡍⡎⠆⠅⡈⠀⡀⠐⢈⠀⠂⡈⠄⠁⢀⠀⠂⠁⠀⠀⠀⠀⠀⠈⠀⠀⠀⠂⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠠⠀⠀⠀⠀⢀⠀⠀⠀⠀⠀⠀⠀⠀⠀`,
  `⠀⠀⠠⠀⠀⡀⠀⠀⠁⠀⠁⠀⠀⠀⡀⠀⠠⠀⠀⡀⠁⠀⠀⠄⠀⠀⠀⢀⠀⠀⡀⠐⠀⠀⡀⠅⢂⢂⢂⠢⡘⢔⠕⡅⡅⠅⢅⠑⡑⠌⠨⠈⢀⠠⠀⠄⢈⠠⠀⡁⠄⠂⠀⠀⠀⠀⠀⢀⠀⠄⠐⠈⠀⠀⠀⠁⠀⠀⠐⠈⠀⠀⠂⠀⠠⠀⠀⠄⠀⠐⠀⠀⠀⠀⠀⠁⠀⠀⠀⠀⡀⠀⠠⠀⠀⠀`,
  `⠀⠀⠀⢀⠀⠀⠀⠈⠀⠀⠐⠈⠀⠀⠀⡀⠀⠠⠀⠀⠀⠐⠀⠀⠠⠈⠀⠀⠀⡀⠀⠀⠠⠀⠀⠀⠂⡐⠠⡑⢜⢔⠕⢜⢌⢊⠢⡐⠠⡀⠄⡐⠠⠐⡀⠂⠄⠂⠠⠀⠠⠀⠀⠁⠀⢀⠀⠀⠀⠀⠀⠀⠀⠀⠐⠀⠀⠠⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⡀⠐⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀`,
  `⠀⠀⠈⠀⠀⠀⠈⠀⠀⠈⠀⠀⢀⠀⠁⠀⠀⢀⠀⠄⠈⠀⠀⠐⠀⠀⢀⠀⠁⠀⠀⠐⠀⠀⠐⠈⠀⠀⠂⠌⠢⠱⡱⡱⣘⢌⢎⢎⢎⢎⢆⠪⡐⡁⠢⠡⢁⠈⠀⠀⠀⠀⠀⠀⠀⢰⠠⠀⠀⠂⠀⠀⠂⠁⠀⠀⢀⠀⠀⠀⠀⠂⠁⠀⠀⠂⠀⠐⠀⠀⠂⠁⠀⠀⠀⠀⠀⠠⠐⠀⠀⠀⠀⠀⠀⠀`,
  `⠀⠀⠀⡀⠀⠄⠂⠀⠈⠀⠀⠄⠀⠀⢀⠠⠐⠀⠀⠀⠀⠀⠂⠀⠀⠂⠀⠀⠀⠄⠂⠀⠠⠐⠀⠀⠀⠐⢀⠈⠈⠌⠌⡪⡒⡕⡕⡕⡑⡐⢔⢑⠔⠨⠈⠐⠀⠀⠀⠐⠀⠀⠂⠈⢀⢧⠣⠀⠀⠀⠀⠀⡀⠀⠀⠀⠀⠀⠀⠈⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠀⠀⠀`,
  `⠀⠀⠀⠀⠀⠀⠀⠀⠠⠀⢀⠀⠀⠄⠀⠀⠀⠀⠀⡀⠈⠀⢀⠀⠁⠀⠀⠐⠀⠀⠀⡀⠀⠀⠀⠀⠁⠀⡆⢐⠀⠄⠀⠐⠈⠐⠁⠂⠂⢈⠐⠐⠈⠀⠐⠀⠀⠀⠄⠀⠀⠀⢀⢠⡳⡕⡇⠀⠀⠀⠀⠀⠀⠀⠀⠁⠀⠀⠐⠀⠀⠀⡀⠄⠂⠁⠀⠀⠂⠀⠀⡀⠀⠀⠀⠀⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀`,
  `⠀⠀⠐⠀⠐⠀⠀⠂⠀⠀⠀⠀⠀⡀⠀⠠⠀⠐⠀⠀⠀⠠⠀⠀⠀⠄⠁⠀⠀⠄⠁⠀⠀⠈⠀⠐⠀⢐⣯⢂⠐⡀⢈⠀⡈⠀⠈⠀⠀⠀⠀⢀⠀⠄⠀⠀⠠⠀⠀⠀⢀⢈⣔⣗⢵⢝⠄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠠⠀⠀⠀⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠀⠀⠀⠀⠀⠂⠁⠀⠀⠀⠀`,
  `⠀⠀⠀⠀⠀⢀⠀⠀⠠⠐⠀⠈⠀⠀⠀⠀⢀⠀⠀⠄⠂⠀⠀⠀⠂⠀⠀⠀⠄⠀⠀⠀⠄⠂⠀⠂⠐⢐⣿⣆⠢⢐⠠⠀⠄⠂⠁⢀⠀⠁⠀⠀⠀⠀⠀⠀⡀⠀⠀⠄⣔⣞⣞⢮⢯⠣⠀⠀⠀⠀⠀⠈⠀⠀⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠠⠐⠀⠀⠀⠠⠀⠀⠀⠀⠠⠀⠀⠀⠀⠀⠀⠀`,
  `⠀⠀⠀⠁⠀⠀⠀⢀⠀⠀⠀⠀⢀⠀⠄⠈⠀⠀⠀⠀⠀⠀⠐⠀⠀⠠⠐⠀⠀⢀⠈⠀⡀⠄⠂⠀⠐⢐⣿⣿⣆⠢⠨⢐⠀⡁⢈⠀⠄⠐⠀⠐⠀⠀⠂⠁⠀⣀⡦⡿⣵⣳⢯⢯⡻⠀⠀⠀⠀⠀⠄⠀⠀⡀⠀⢀⠀⠂⠁⠀⠠⠀⠐⠀⠀⠠⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⡀⠀⠀⠀⠀⠀⠀⠀⠀`,
  `⠀⠀⠀⠀⠄⠐⠀⠀⠀⠀⠐⠈⠀⠀⠀⠀⠀⠀⠐⠈⠀⠀⠄⠀⠐⠀⠀⢀⠐⠀⠀⡀⠀⠀⡀⠀⡁⢐⣿⣟⣿⣿⣌⠐⡐⡀⠂⠄⠂⠀⠂⠐⠀⢁⠀⣢⣞⡾⣯⢿⣳⢿⣽⡻⠂⠀⠠⠀⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⠀⠀⡀⠀⠄⠀⠀⠀⡀⠀⠀⡀⠠⠀⠀⢀⠀⠀⠀⠀⠀⠀⠀⡀⠄⠀`,
  `⠀⠀⠀⡀⠀⠀⠀⠀⠠⠐⠀⠀⠀⠀⠀⢀⠀⠁⠀⠀⠀⢀⠀⠀⠄⠀⠂⠀⢀⠀⠂⠀⠀⠁⠀⡀⢀⠠⣿⣿⣿⣿⣻⣷⣄⠂⠅⠌⠄⠡⠈⠄⢡⣰⣾⢿⣽⣟⣿⣻⣽⣻⢞⠇⠀⠂⠀⠀⠀⠀⠀⠀⠠⠀⠠⠀⠀⢀⠈⠀⠀⠀⠀⠀⠀⠀⠐⠀⠀⠀⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠠⠀⠀⠀⠀`,
  `⠀⠀⠀⠀⠀⠀⠐⠀⠀⠀⠀⠀⠀⠐⠀⠀⠀⠀⠠⠀⠁⠀⠀⠐⠀⠐⠀⠈⠀⢀⠠⠈⠀⠈⠀⢀⠀⠀⢿⣽⣷⣿⣿⣿⣿⣳⣌⠨⠨⠨⢨⣸⣾⣿⣾⣿⣿⣻⣯⢿⣺⡽⡏⠄⠀⠠⠀⠠⠀⠐⠀⠀⠀⠀⠀⠀⠀⠀⠀⡀⠀⠁⠀⠁⠀⠁⠀⠀⡀⠀⠀⠀⠀⠄⠀⠄⠀⠀⡀⠀⠀⠀⠀⠀⠀⠀`,
  `⠀⠀⠀⢀⠀⠂⠀⠀⠀⡀⠄⠀⠁⠀⢀⠠⠐⠀⠠⠀⠐⠀⠁⠀⠂⠀⠂⠀⠁⠀⠀⠠⠀⠁⠠⠀⠐⠈⣺⣿⣿⣿⣿⣿⢟⠏⠉⠓⠗⠟⢿⣿⣯⣿⣯⣷⣿⣯⡿⣯⡷⣿⠡⠀⠠⠀⢀⠀⢀⠀⢀⠀⠁⠀⠁⠀⠀⠄⠂⠀⠀⠂⠁⠀⠐⠀⠀⠁⠀⠀⠐⠈⠀⠀⠀⠀⠀⡀⠀⠀⠈⠀⠀⠀⠀⠀`,
  `⠀⠀⠀⠀⠀⠀⠀⢀⠀⠀⠀⠀⠠⠐⠀⠀⠀⡀⠄⠀⠂⠀⠂⠁⠀⠂⠀⠂⠀⠐⠈⠀⠀⠂⢀⠐⠈⠀⣺⣿⣾⣿⡽⠁⠀⡀⠐⠀⠠⠀⠀⠘⢻⡿⣯⣿⣷⢿⣿⣻⣟⡏⠀⡀⢀⠀⠀⡀⠀⢀⠀⠀⠀⠀⡀⠄⠀⡀⠀⠄⠂⠀⠄⠂⠀⠂⠈⠀⠀⠐⠀⠀⢀⠀⠄⠂⠁⠀⠀⠀⠠⠐⠀⠐⠀⠀`,
  `⠀⠀⠀⠀⡀⠀⠄⠀⢀⠈⠀⠈⠀⠀⡀⠐⠀⠀⡀⠄⠂⠐⠀⠐⠀⠐⠀⠐⠈⠀⡀⠈⢀⠐⠀⢀⠐⠀⢺⣯⣷⡟⠀⡀⠀⠀⢀⠁⢀⠀⠀⠀⠀⠉⠿⣿⣾⣿⢿⣽⡿⠀⠂⠀⠀⢀⠀⢀⠠⠀⠀⠐⠀⢀⠀⠀⠀⡀⠀⡀⠠⠀⠀⡀⠄⠀⠄⠂⠁⠀⡀⠈⠀⠀⠀⠀⠀⠀⠀⠠⠀⠀⠀⠀⠀⠀`,
  `⠀⠀⠀⠀⠀⠀⠀⢀⠀⠀⠄⠂⠀⠁⠀⠀⠄⠁⠀⠀⡀⠄⠂⠀⠂⠐⠀⠂⠐⠀⠀⠄⠀⠠⠀⠠⠀⡀⢹⣿⠟⡤⣕⣶⡀⠀⠀⠄⠀⠀⠀⠀⠀⡀⢠⡹⣯⣿⡿⣿⡋⠀⠀⠂⠈⠀⠀⠀⠀⡀⠐⠀⠈⠀⠀⠠⠀⠀⠀⠀⢀⠠⠀⠀⢀⠀⢀⠀⠠⠀⠀⠀⠄⠐⠀⠐⠀⠁⠀⠀⠀⠀⠀⠀⠀⠀`,
  `⠀⠀⠀⠀⠄⠀⠀⠄⠀⠠⠀⠠⠐⠈⠀⠐⠀⠠⠈⠀⠀⢀⠠⠐⠀⠐⠀⠐⠀⡀⠁⢀⠐⠀⠐⠀⠠⠀⠨⣟⢼⣿⣟⣷⣷⡀⠀⠂⠀⠀⠀⢀⢢⡪⣷⡿⣿⡾⣿⡟⠀⡀⠁⠀⠄⠂⠈⠀⢀⠀⠠⠐⠈⠀⠐⠀⠀⠀⠈⠀⡀⠀⢀⠈⠀⠀⠀⢀⠀⠠⠐⠀⠀⢀⠀⢀⠀⠀⡀⠈⠀⠀⠀⠀⠀⠀`,
  `⠀⠀⠀⠀⠀⠀⠠⠐⠀⠀⠠⠀⠀⠄⠂⠐⠀⠠⠀⠂⠁⠀⠀⡀⠄⠐⠀⠂⢀⠀⠄⢀⠠⠐⠀⠈⢀⠀⢱⢽⣿⣿⣻⣿⢿⡆⠀⠈⠀⠀⠀⡢⣷⣻⣿⣿⣿⣟⣷⠃⠀⡀⠠⠀⢀⠠⠀⠂⠀⢀⠀⠄⠀⠐⠀⠀⢀⠈⠀⡀⠀⠠⠀⠀⠠⠈⠀⠀⠀⡀⠀⡀⠄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀`,
  `⠀⠀⠀⠀⠐⠀⠀⠄⠀⠐⠀⠀⠂⠀⠠⠀⠂⠀⠠⠀⠐⠀⠁⠀⠀⡀⠄⠂⠀⡀⠠⠀⢀⠠⠀⠁⢀⠀⢸⢽⣿⣿⣟⣿⣿⠅⢈⠀⠀⠀⠀⢯⣿⢿⣾⣿⣟⡾⡟⠀⠁⠀⠀⢀⠀⠀⡀⠠⠐⠀⠀⢀⠐⠀⠀⠠⠀⠀⡀⠀⠄⠂⠀⠐⠀⠀⠄⠈⠀⠀⠀⠀⠀⠀⠐⠀⠀⠁⠀⠀⠀⠀⠀⠀⠁⠀`,
  `⠀⠀⠀⠀⠀⠀⠄⠂⠀⠄⠂⠁⠀⠈⠀⡀⠄⠈⠀⠀⠂⠀⠂⠈⠀⠀⢀⠠⠀⢀⠠⠀⢀⠀⡀⠈⢀⠀⠸⣽⢿⣿⣻⡿⣾⠁⡀⠀⠀⠀⠀⠸⣻⣿⢿⣿⣞⣿⠃⠈⠀⠐⠈⠀⠀⡀⠀⡀⠀⠄⠈⠀⠀⠀⠠⠀⠠⠀⢀⠀⠄⠀⠐⠀⠐⠀⠀⠠⠀⠂⠀⠂⠀⠁⠀⠀⠄⠀⠀⠀⠀⡀⠄⠀⠀⠀`,
  `⠀⠀⠀⠀⠁⠀⠀⠄⠀⡀⠀⢀⠈⠀⠠⠀⠀⠠⠈⠀⠐⠀⠂⢀⠈⠀⡀⠀⠄⠀⡀⠄⠀⡀⠀⠐⠀⠀⢘⢾⣿⣿⣿⣻⠃⢀⠀⡀⠀⠀⠀⠈⣗⣿⣿⣷⣻⡯⠀⠈⠀⠠⠀⠐⠀⠀⡀⠀⠄⠀⠐⠈⠀⠀⠄⠀⠄⠀⡀⠀⢀⠀⠂⠀⠠⠐⠀⠀⠀⡀⠀⡀⠀⠀⠀⡀⠀⠀⠀⠀⠁⠀⠀⠀⠀⠀`,
  `⠀⠀⠀⠀⠀⠀⠂⠀⢀⠀⠀⠀⡀⠐⠀⢀⠈⠀⢀⠐⠀⠐⠀⢀⠠⠀⠀⠄⠐⠀⢀⠀⠄⠀⡀⠁⡀⠁⢈⣟⣾⣿⣽⠇⠐⠀⡀⠀⡀⠄⠀⠀⢸⣽⣿⣗⣿⠁⠠⠀⠁⠀⡀⠄⠂⠁⠀⡀⠄⠂⠁⠀⠀⠄⠀⠄⠀⠄⠀⢀⠀⠀⡀⠐⠀⠀⠀⠀⠁⠀⠀⠀⠀⠈⠀⠀⠀⠀⢀⠀⠀⠀⠀⠀⠀⠀`,
  `⠀⠀⠀⠀⠐⠈⠀⠀⢀⠀⠀⠄⠀⢀⠐⠀⠀⠈⠀⠀⠀⠂⠈⠀⠀⠠⠐⠀⠀⠂⠀⡀⠠⠀⢀⠀⠠⠀⢀⢷⣻⣟⡿⠀⠂⠀⠄⠀⡀⠀⠀⠀⢘⣾⡿⣞⡯⠀⠠⠀⠐⠀⠀⠀⡀⠄⠀⡀⠀⡀⠀⠀⠄⠀⠄⠀⠄⠀⠄⠀⢀⠀⠀⠀⢀⠀⠁⠀⠠⠀⠠⠀⠀⠀⠠⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀`,
  `⠀⠀⠀⠀⠀⡀⠐⠈⠀⠀⠀⠀⡀⠀⡀⠠⠈⠀⠀⠁⠀⠂⠀⠂⠁⠀⡀⠄⠁⠀⠂⠀⡀⠄⠀⠠⠀⠂⠀⢯⡿⣿⠇⠀⠄⠁⠠⠀⢀⠀⠠⠀⢐⢽⣿⣽⠁⠠⠀⠀⠄⠐⠈⠀⠀⢀⠀⡀⠀⠀⠀⠄⠀⠄⠀⠄⠀⡀⠀⠄⠀⠀⠀⠁⠀⠀⠀⠠⠀⠀⠀⠀⠀⠀⠄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀`,
  `⠀⠀⠀⠀⠀⢀⠀⠀⠀⠀⠂⠀⠀⠀⠀⠀⡀⠀⠁⠀⠁⠀⠂⠀⠂⠁⠀⠀⠠⠈⠀⠠⠀⢀⠐⠀⠠⠀⠀⡳⣿⣿⠁⠀⠄⠈⡀⠄⠀⡀⠀⡀⠠⣻⣗⡏⠀⠄⠀⠄⠀⡀⠄⠐⠈⠀⠀⢀⠀⠐⠀⠠⠀⠠⠀⢀⠀⠀⢀⠀⢀⠀⠁⠀⠀⠠⠐⠀⠀⠀⠄⠀⠀⠠⠀⠀⠀⠀⠠⠀⠀⠀⠀⠀⠀⠀`,
  `⠀⠀⠀⠀⠈⠀⠀⠀⠈⠀⠀⠀⠀⠈⠀⡀⠀⡀⠈⠀⠀⠁⢀⠐⠀⠐⠀⠁⠀⠄⠈⠀⠠⠀⠀⠐⠀⠐⠀⢪⣟⣗⠀⠂⠀⠂⢀⠠⠀⠀⠄⠀⠠⣿⣳⠁⠀⠄⠀⡀⠀⡀⠀⡀⠄⠐⠈⠀⠀⠀⠄⠀⠄⠀⡀⠀⠀⠈⠀⠀⠀⠀⠀⠀⠂⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠀⠀⠀`,
  `⠀⠀⠀⠀⠀⠂⠈⠀⠀⡀⠀⠂⠀⠁⠀⠀⠀⠀⠀⠈⠀⠈⠀⠀⠠⠐⠀⠀⠂⠀⡀⠁⢀⠀⠁⡀⠈⢀⠀⠰⣽⡇⠐⠀⠁⠠⠀⠀⠄⠂⠀⠀⠠⣿⠇⠐⠀⢀⠀⠀⡀⠀⢀⠀⢀⠀⠄⠀⠀⠄⠀⠄⠀⡀⠀⠀⠁⠀⠠⠀⠀⠄⠐⠀⠀⠀⠠⠐⠈⠀⠀⠀⠀⠂⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀`
];

function colorBlock(r, g, b) {
  return `${ansiBgRGB(r, g, b)} ${ANSI_RESET}`;
}

const vfs = new Map([
  ['/home/db/about.txt', `Hi, I'm Devkumar! I am a student at Texas A&M University pursuing a B.S. in Computer Science (2029). My journey into computing began when I built my first PC in 5th grade. That experience opened my eyes to the incredible power of technology in unlocking creative potential and crafting something truly unique.

Today, I research cancer radiology @ MD Anderson, graph neural networks @ DIVE Lab, and security @ AGGIES Lab, while working as an SRE intern @ Lockheed Martin. I've previously contributed to nanomedicine ML research @ Houston Methodist and built transcriptomics platforms @ UTHSCSA.

If you'd like to connect, collaborate, or discuss exciting projects, please do not hesitate to reach out!`],
  ['/home/db/links/', `linkedin
github
keybase
resume.pdf`],
]);

const RESUME = {
  Firstname: 'Devkumar',
  Lastname: 'Banerjee',
  Education: 'BS Computer Science, Texas A&M (2029)',
  Research: ['MD Anderson (Cancer Radiology)', 'DIVE Lab (GNN — Materials)', 'AGGIES Lab (Security)', 'Houston Methodist (Nanomedicine)', 'UTHSCSA (PCPG Transcriptomics)'],
  Work: ['AI/SRE Intern @ Lockheed Martin', 'SF Dev @ The Association of Former Students'],
  Skills: ['Python', 'PyTorch', 'C', 'C++', 'Java', 'Linux', 'Docker', 'Ansible', 'Keras', 'Streamlit'],
  Certs: ['GSEC', 'GFACT', 'AZ-900', 'SC-900', 'Linux Pro', 'CCST', 'ITF+', 'RVFA'],
  User: 'db',
};

const FORTUNES = [
  'Technology is anything that wasn\'t around when you were born — Alan Kay',
  'Any sufficiently advanced technology is equivalent to magic — Arthur C. Clarke',
  'All of the biggest technological inventions created by man - the airplane, the automobile, the computer - says little about his intelligence, but speaks volumes about his laziness — Mark Kennedy',
  'Just because something doesn\'t do what you planned it to do doesn\'t mean it\'s useless — Thomas Edison',
  'It has become appallingly obvious that our technology has exceeded our humanity — Albert Einstein',
  'One machine can do the work of fifty ordinary men.  No machine can do the work of one extraordinary man — Elbert Hubbard',
  'Technology is a word that describes something that doesn\'t work yet — Douglas Adams',
  'Humanity is acquiring all the right technology for all the wrong reasons — R. Buckminster Fuller',
  'I think that novels that leave out technology misrepresent life as badly as Victorians misrepresented life by leaving out sex — Kurt Vonnegut',
  'The human spirit must prevail over technology — Albert Einstein',
  'The great myth of our times is that technology is communication — Libby Larsen',
  'You cannot endow even the best machine with initiative; the jolliest steamroller will not plant flowers — Walter Lippmann',
  'We are stuck with technology when what we really want is just stuff that works — Douglas Adams',
  'Technology made large populations possible; large populations now make technology indispensable — Joseph Krutch',
  'This is the whole point of technology.  It creates an appetite for immortality on the one hand.  It threatens universal extinction on the other. Technology is lust removed from nature — Don DeLillo',
  'The real danger is not that computers will begin to think like men, but that men will begin to think like computers — Sydney Harris',
  'If we continue to develop our technology without wisdom or prudence, our servant may prove to be our executioner — Omar Bradley',
  'The art challenges the technology, and the technology inspires the art — John Lasseter',
  'Science and technology revolutionize our lives, but memory, tradition and myth frame our response — Arthur Schlesinger',
  'The science of today is the technology of tomorrow — Edward Teller',
  'Imagination is the Discovering Faculty, pre-eminently. It is that which penetrates into the unseen worlds around us, the worlds of Science — Ada Lovelace',
  'Software is like sex: It\'s better when it\'s free — Linus Torvalds',
  'Good programmers use their brains, but good guidelines save us having to think out every case — Francis Glassborow',
  'First learn computer science and all the theory.  Next develop a programming style.  Then forget all that and just hack — George Carrette',
  'There are two ways to write error-free programs; only the third one works — Alan J. Perlis',
  'That\'s been one of my mantras — focus and simplicity. Simple can be harder than complex; you have to work hard to get your thinking clean to make it simple — Steve Jobs',
  'The function of good software is to make the complex appear to be simple — Grady Booch',
  'I do not fear computers. I fear lack of them — Isaac Asimov',
  'Standards are always out of date.  That\'s what makes them standards — Alan Bennett',
  'To iterate is human, to recurse divine — L. Peter Deutsch',
  'Computers are good at following instructions, but not at reading your mind — Donald Knuth',
  'Never underestimate the bandwidth of a station wagon full of tapes hurtling down the highway — Andrew S. Tanenbaum',
  'Errors using inadequate data are much less than those using no data at all — Charles Babbage',
  'Technology is just a tool. In terms of getting the kids working together and motivating them, the teacher is the most important — Bill Gates',
  'Programs must be written for people to read, and only incidentally for machines to execute — Gerald Jay Sussman',
  'Code generation, like drinking alcohol, is good in moderation — Alex Lowe',
  'Never trust a computer you can\'t throw out a window — Steve Wozniak',
  'The best way to predict the future is to implement it — David Heinemeier Hansson',
  'UNIX is simple.  It just takes a genius to understand its simplicity — Dennis Ritchie',
  'Should array indices start at 0 or 1?  My compromise of 0.5 was rejected without, I thought, proper consideration — Stan Kelly-Bootle',
  'I think computer viruses should count as life.  I think it says something about human nature that the only form of life we have created so far is purely destructive.  We\'ve created life in our own image — Stephen Hawking',
  'It would appear that we have reached the limits of what it is possible to achieve with computer technology, although one should be careful with such statements, as they tend to sound pretty silly in 5 years — John Von Neumann',
  'Companies spend millions of dollars on firewalls, encryption and secure access devices, and it\'s money wasted, because none of these measures address the weakest link in the security chain — Kevin Mitnick',
  'A computer would deserve to be called intelligent if it could deceive a human into believing that it was human — Alan Turing',
  'Technology feeds on itself. Technology makes more technology possible — Alvin Toffler',
  'To err is human, but to really foul things up you need a computer — Paul Ehrlich',
  'The difference between theory and practice is that in theory, there is no difference between theory and practice — Richard Moore',
  'Computers are useless.  They can only give you answers — Pablo Picasso',
  'Computers are like Old Testament gods; lots of rules and no mercy — Joseph Campbell',
  'In C++ it\'s harder to shoot yourself in the foot, but when you do, you blow off your whole leg — Bjarne Stroustrup',
  'It\'s still magic even if you know how it\'s done — Terry Pratchett',
  'The use of COBOL cripples the mind; its teaching should therefore be regarded as a criminal offense — E.W. Dijkstra',
  'It\'s supposed to be automatic, but actually you have to push this button — John Brunner',
  'Technology is best when it brings people together — Matt Mullenweg',
  'The Web as I envisaged it, we have not seen it yet. The future is still so much bigger than the past — Tim Berners-Lee',
  'It\'s not a faith in technology. It\'s faith in people — Steve Jobs',
  'Technology is a useful servant but a dangerous master — Christian Lous Lange',
  'Programming is the art of algorithm design and the craft of debugging errant code — Ellen Ullman',
  'If we want users to like our software, we should design it to behave like a likable person — Alan Cooper',
  'Everybody should learn to program a computer because it teaches you how to think — Steve Jobs',
  'Software and cathedrals are much the same — first we build them, then we pray — Sam Redwine',
  'Most good programmers do programming not because they expect to get paid or get adulation by the public, but because it is fun to program — Linus Torvalds',
  'You might not think that programmers are artists, but programming is an extremely creative profession. It’s logic-based creativity — John Romero',
  'Programming is learned by writing programs — Brian Kernighan',
  'The most important property of a program is whether it accomplishes the intention of its user — C.A.R. Hoare',
  'The best error message is the one that never shows up — Thomas Fuchs',
  'There is always one more bug to fix — Ellen Ullman',
  'Sometimes it pays to stay in bed on Monday, rather than spending the rest of the week debugging Monday\'s code — Dan Salomon',
  'If, at first, you do not succeed, call it version 1.0 — Khayri R.R. Woulfe',
  'The best performance improvement is the transition from the nonworking state to the working state — J. Osterhout',
  'The most important single aspect of software development is to be clear about what you are trying to build — Bjarne Stroustrup',
  'Perfection is achieved not when there is nothing more to add, but rather when there is nothing more to take away. — Antoine de Saint-Exupery',
  'When to use iterative development? You should use iterative development only on projects that you want to succeed — Martin Fowler',
  'The best way to predict the future is to invent it — Alan Kay',
  'The most disastrous thing that you can ever learn is your first programming language — Alan Kay',
  'Make it work, make it right, make it fast — Kent Beck',
  'Java is to JavaScript what car is to Carpet — Chris Heilmann',
  'Experience is the name everyone gives to their mistakes — Oscar Wilde',
  'First, solve the problem. Then, write the code — John Johnson',
  'Optimism is an occupational hazard of programming: feedback is the treatment — Kent Beck',
  'Simple things should be simple, complex things should be POSSIBLE — Alan Kay',
  'Always code as if the guy who ends up maintaining your code will be a violent psychopath who knows where you live. — Martin Golding',
  'Programming is not about typing, it\'s about thinking — Rich Hickey',
  'Any fool can write code that a computer can understand. Good programmers write code that humans can understand — Martin Fowler',
  'Talk is cheap. Show me the code — Linus Torvalds',
  'The computer was born to solve problems that did not exist before — Bill Gates',
  'The amateur software engineer is always in search of magic — Grady Booch',
  'The best designers will use many design patterns that dovetail and intertwine to produce a greater whole — Erich Gamma',
  'If it\'s not tested, it\'s broken — Bruce Eckel',
  'Give users what they actually want, not what they say they want — Kathy Sierra',
  'Debugging is like being the detective in a crime movie where you are also the murderer — Filipe Fortes',
  'Computing is kind of a mess. Your computer doesn\'t know where you are. It doesn\'t know what you\'re doing. It doesn\'t know what you know — Larry Page',
  'JavaScript is the world\'s most misunderstood programming language — Douglas Crockford',
  'The cleaner and nicer the program, the faster it\'s going to run. And if it doesn\'t, it\'ll be easy to make it fast — Joshua Bloch',
  'Often, the most striking and innovative solutions come from realizing that your concept of the problem was wrong — Eric S. Raymond',
  'It is often easier to ask for forgiveness than to ask for permission — Grace Hopper',
  'You can divide our industry into two kinds of people: those who want to go work for a company to make it successful, and those who want to go work for a successful company — Jamie Zawinski',
  'A language that doesn\'t affect the way you think about programming is not worth knowing — Alan Perlis',
  'In the practical world of computing, it is rather uncommon that a program, once it performs correctly and satisfactorily, remains unchanged forever — Niklaus Wirth',
  'Much of my work has come from being lazy — John Backus',
  'For much of the Internet, the shortest path between two points doesn\'t exist — Kevin Poulsen',
  'Creativity comes from applying things you learn in other fields to the field you work in — Aaron Swartz',
  'In JavaScript, there is a beautiful, elegant, highly expressive language that is buried under a steaming pile of good intentions and blunders — Douglas Crockford',
  'This is why I loved technology: if you used it right, it could give you power and privacy — Cory Doctorow',
  'Fools ignore complexity. Pragmatists suffer it. Some can avoid it. Geniuses remove it. — Alan Perlis',
  'If you can\'t understand the spec for a new technology, don\'t worry: nobody else will understand it either, and the technology won\'t be that important — Joel Spolsky',
  'Just because something is a standard doesn\'t mean it is the right choice for every application. Like XML, for example — Douglas Crockford',
  'To solve an interesting problem, start by finding a problem that is interesting to you — Eric S. Raymond',
  'If you\'re not doing some things that are crazy, then you\'re doing the wrong things — Larry Page',
  'We have to stop optimizing for programmers and start optimizing for users — Jeff Atwood',
  'Prolific programmers contribute to certain disaster — Niklaus Wirth',
  'Any application that can be written in JavaScript, will eventually be written in JavaScript — Jeff Atwood',
  'Software is getting slower more rapidly than hardware becomes faster — Niklaus Wirth',
  'Unix was not designed to stop you from doing stupid things, because that would also stop you from doing clever things — Douglas Gwyn',
  'The most damaging phrase in the language is: \"It\'s always been done that way\" — Grace Hopper',
  'Peers can be the best teachers, because they\'re the ones that remember what it\'s like to not understand — Peter Norvig',
  'From then on, when anything went wrong with a computer, we said it had bugs in it — Grace Hopper',
  'Many people tend to look at programming styles and languages like religions: if you belong to one, you cannot belong to others. But this analogy is another fallacy — Niklaus Wirth',
  'It is hard to write even the smallest piece of code correctly — Joshua Bloch',
  'It isn\'t enough to think outside the box. Thinking is passive. Get used to acting outside the box — Tim Ferriss',
  'Once you get to naming your laptop, you know that you\'re really having a deep relationship with it — Cory Doctorow',
  'Common programmer thought pattern: there are only three numbers: 0, 1, and n — Joel Spolsky',
  'There\'s a good part of Computer Science that\'s like magic. Unfortunately there\'s a bad part of Computer Science that\'s like religion — Hal Abelson',
  'Smart data structures and dumb code works a lot better than the other way around — Eric S. Raymond',
  'No computer is ever going to ask a new, reasonable question. It takes trained people to do that — Grace Hopper',
  'Start out by making 100 users really happy, rather than a lot more users only a little happy — Paul Buchheit',
  'What is the most important thing you could be working on in the world right now? ... And if you\'re not working on that, why aren\'t you? — Aaron Swartz',
  'Teaching peers is one of the best ways to develop mastery — Jeff Atwood',
  'No one should do a job he can do in his sleep — Cory Doctorow',
  'Nobody is going to pour truth into your brain. It\'s something you have to find out for yourself — Noam Chomsky',
  'The computer revolution is a revolution in the way we think and in the way we express what we think — Hal Abelson',
  'When you choose a language, you\'re choosing more than a set of technical trade-offs, you\'re choosing a community — Joshua Bloch',
  'JavaScript is the only language that I\'m aware of that people feel they don\'t need to learn before they start using it — Douglas Crockford',
  'Almost everyone who has had an idea that\'s somewhat revolutionary or wildly successful was first told they\'re insane — Larry Page',
  'One can steal ideas, but no one can steal execution or passion — Tim Ferriss',
  'If everything you do works, then you\'re not taking many risks and probably aren\'t innovating either — Paul Buchheit',
  'It turns out the Internet is this amazing resource for everyone who has access to it — Alexis Ohanian',
  'Being a young programmer today must be awful—you can choose 20 different programming languages, dozens of framework and operating systemsand you\'re paralyzed by choice — Joe Armstrong',
  'In some ways, programming is like painting. You start with a blank canvas and certain basic raw materials. You use a combination of science, art, and craft to determine what to do with them — Andrew Hunt',
  'Testing leads to failure, and failure leads to understanding — Burt Rutan',
  'Programming isn\'t about what you know; it\'s about what you can figure out — Chris Pine',
  'If you optimize everything, you will always be unhappy — Donald Knuth',
  'If debugging is the process of removing bugs, then programming must be the process of putting them in — E.W. Dijkstra',
  'Coding isn\'t the poor handmaiden of design or analysis. Coding is where your fuzzy ideas awaken in the harsh dawn of reality — Kent Beck',
  'Inside every well-written large program is a well-written small program — C.A.R. Hoare',
  'So much complexity in software comes from trying to make one thing do two things — Ryan Singer',
  'Code is like humor. When you have to explain it, it\'s bad — Cory House',
  'The more I study, the more insatiable do I feel my genius for it to be — Ada Lovelace',
  'There are only two hard things in Computer Science: cache invalidation and naming things — Phil Karlton',
  'All programming languages are shit. But the good ones fertilize your mind — Reginald Braithwaite',
  'The question of whether Machines Can Think... is about as relevant as the question of whether Submarines Can Swim — E.W. Dijkstra',
  'Computer science education cannot make anybody an expert programmer any more than studying brushes and pigment can make somebody an expert painter — Eric S. Raymond',
  'Programming languages, like pizza, come in only two sizes: too big and too small — Eric S. Raymond',
  'Computer Science is no more about computers than astronomy is about telescopes — Richard E. Pattis',
  'Languages that try to disallow idiocy become themselves idiotic — Rob Pike',
  'Perl: The only language that looks the same before and after RSA encryption — Keith Bostic',
  'Not everything I say is correct. It\'s correct modulo the little details you\'re going to have to worry about — John Hopcroft',
  'There is nothing in the programming field more despicable than an undocumented program — Edward Yourdon',
  'Beware of bugs in the above code; I have only proved it correct, not tried it — Donald Knuth',
  'Good programmers don\'t just write programs. They build a working vocabulary — Guy Steele',
  'In carpentry, you measure twice and cut once. In software development, you never measure and make cuts until you run out of time — Adam Morse',
  'Hofstadter\'s Law: It always takes longer than you expect, even when you take into account Hofstadter\'s Law — Douglas Hofstadter',
  'What we have to learn to do, we learn by doing — Aristotle',
  'One day, you\'ll turn off the feature that emails you every time someone buys your software. That\'s a huge milestone — Joel Spolsky',
  'Somebody finds the problem, and somebody else understands it. And I\'ll go on record as saying that finding it is the bigger challenge — Linus Torvalds',
  'Within a computer natural language is unnatural — Alan Perlis',
  'I love deadlines. I like the whooshing sound they make as they fly by — Douglas Adams',
  'When I am working on a problem, I never think about beauty. I think only of how to solve the problem. But when I have finished, if the solution is not beautiful, I know it is wrong — R. Buckminster Fuller',
  'Design and programming are human activities; forget that and all is lost — Bjarne Stroustrup',
  'Most of the biggest problems in software are problems of misconception — Rich Hickey',
  'After more than 30 years of programming, we ought to know that the design of complex software is inherently difficult — Niklaus Wirth',
  'If we wish to count lines of code, we should not regard them as \"lines produced\" but as \"lines spent\" — E.W. Dijkstra',
  'Working ten hour days allows you to fall behind twice as fast as you could working five hour days — Isaac Asimov',
  'Measuring programming progress by lines of code is like measuring aircraft building progress by weight — Bill Gates',
  'The designer of a new kind of system must participate fully in the implementation — Donald Knuth',
  'The only way to learn a new programming language is by writing programs in it — Dennis Ritchie',
  'Anyone who considers arithmetical methods of producing random digits is, of course, in a state of sin — John Von Neumann',
  'We shall do a much better programming job, provided we approach the task with a full appreciation of its tremendous difficulty, provided that we respect the intrinsic limitations of the human mind and approach the task as very humble programmers — Alan Turing',
  'Learn the principle, abide by the principle, and dissolve the principle — Bruce Lee',
  'Remember, to learn and not to do is really not to learn. To know and not to do is really not to know — Stephen Covey',
  'Technology like art is a soaring exercise of the human imagination — Daniel Bell',
  'Let\'s go invent tomorrow instead of worrying about what happened yesterday — Steve Jobs',
  'The great growling engine of change - technology — Alvin Toffler',
  'Innovation is the outcome of a habit, not a random act — Sukant Ratnakar',
  'The technology you use impresses no one. The experience you create with it is everything — Sean Gerety',
  'It\'s not that we use technology, we live technology — Godfrey Reggio',
  'The real problem is not whether machines think but whether men do. — B.F. Skinner',
  'Fight Features … The only way to make software secure, reliable, and fast is to make it small — Andrew S. Tanenbaum',
  'The nice thing about standards is that you have so many to choose from — Andrew S. Tanenbaum',
  'Half of the battle of building performant software is caring enough to look — AJ Stuyvenberg',
  'The thing is, you can\'t fake drive. If you try to, you can easily burnout — Sophia Turner',
  'Computer Science is no more about computers than astronomy is about telescopes — E.W. Dijkstra',
  'Progress is man\'s ability to complicate simplicity — Thor Heyerdahl',
  'Don\'t shoot a fly with a cannon — Paolo Insogna',
  'The essential part of any program, the theory of it, is something that could not conceivably be expressed, but is inextricably bound to human beings. — Peter Naur',
  'The most powerful tool we have as developers is automation — Scott Hanselman',
  'The only way to go fast, is to go well — Robert C. Martin',
  'Controlling complexity is the essence of computer programming — Brian Kernighan',
  'If you can\'t deploy your service, it\'s not done — Jez Humble',
  'One of my most productive days was throwing away 1000 lines of code — Ken Thompson',
  'Data trumps intuition — Peter Norvig',
  'Choose boring technology — Dan McKinley',
  'Shipping first-time code is like going into debt. A little debt speeds development so long as it is paid back promptly with refactoring — Ward Cunningham',
  'Design is not just what it looks like and feels like. Design is how it works — Steve Jobs',
  'A little duplication is better than a little dependency — John Ousterhout',
  'The purpose of computing is insight, not numbers — Richard Hamming',
  'Any organization that designs a system will produce a design whose structure is a copy of the organization\'s communication structure — Melvin Conway',
  'Adding manpower to a late software project makes it later — Frederick P. Brooks Jr.',
  'The future is uncertain and you will never know less than you know right now — Sandi Metz',
  'The problem with poorly designed small applications is that if they are successful, they grow up to be poorly designed big applications — Sandi Metz',
  'The first way design fails is due to lack of it — Sandi Metz'
];

const CMD_HISTORY = [];
CMD_HISTORY.idx = -1;

let _hnItems = [];
let _prefetchedLocation = null;

let asyncCPU = null;

(async () => {
  try {
    if (navigator.userAgentData?.getHighEntropyValues) {
      const hints = await navigator.userAgentData.getHighEntropyValues(['architecture', 'bitness', 'model']);
      if (hints.architecture) {
        let s = hints.architecture;
        if (hints.bitness) s += ` (${hints.bitness}-bit)`;
        if (hints.model) s += ` · ${hints.model}`;
        if (navigator.hardwareConcurrency) s += ` ${navigator.hardwareConcurrency}-core`;
        asyncCPU = s;
      }
    }
  } catch (_) {}
  fetch('https://ipapi.co/json/')
    .then(r => r.json())
    .then(d => { _prefetchedLocation = { lat: d.latitude, lon: d.longitude, city: d.city, region: d.region, region_code: d.region_code, country: d.country_code }; })
    .catch(() => {});
})();

function getCPU() {
  try {
    const parts = [];
    const p = navigator.platform || '';
    const ua = navigator.userAgent || '';
    if (ua.includes('ARM64') || ua.includes('aarch64')) parts.push('ARM');
    else if (ua.includes('x64') || ua.includes('Win64') || ua.includes('x86_64')) parts.push('x86_64');
    else if (p.includes('Intel') || p.includes('Win') || p.includes('Mac')) parts.push('x86_64');
    else if (p.includes('ARM')) parts.push('ARM');
    else if (p) parts.push(p.replace(/[_\d].*$/, ''));
    if (navigator.hardwareConcurrency) parts.push(`${navigator.hardwareConcurrency}-core`);
    return parts.join(' ') || 'db';
  } catch { return 'db'; }
}

function getGPU() {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (gl) {
      // Prefer the spec'd plain RENDERER string — real GPU name on modern
      // engines, so no UA sniff and no deprecated debug-info extension probe
      // (Firefox logs a warning for it). Fall back to the extension only when
      // RENDERER is a useless generic placeholder (older engines).
      let r = '';
      try { r = String(gl.getParameter(gl.RENDERER) || '').trim(); } catch (_) { r = ''; }
      if (/^(webkit webgl|mozilla|generic|unknown)/i.test(r)) r = '';
      if (!r) {
        try {
          const ext = gl.getExtension('WEBGL_debug_renderer_info');
          if (ext) r = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '').trim();
        } catch (_) { r = ''; }
      }
      return r.replace(/^ANGLE\s*\(/i, '').replace(/\)$/, '') || 'Unknown';
    }
  } catch (_) {}
  return 'Unknown';
}

let BOOT_MSGS = null;

function writePrompt(term) {
  term.write(`\r\n${SITE_GREEN}db${ANSI_RESET}${SITE_WHITE}@${ANSI_RESET}${SITE_CYAN}dvxb.io${ANSI_RESET}${SITE_MUTED} ${ANSI_RESET}${SITE_BLUE}~${ANSI_RESET}${SITE_MUTED}❯ ${ANSI_RESET}`);
}

function bootSequence(term, onDone) {
  if (!BOOT_MSGS) {
    const cpu = asyncCPU || getCPU();
    const memGB = navigator.deviceMemory || 2;
    BOOT_MSGS = [
      { text: '[    0.000000] Booting dvxb.io...', color: SITE_FAINT },
      { text: `[    0.004201] CPU: ${cpu} Genuine`, color: SITE_FAINT },
      { text: `[    0.008503] GPU: ${getGPU()}`, color: SITE_FAINT },
      { text: `[  OK  ] System clock: ${new Date().toLocaleTimeString()}`, color: SITE_OK },
      { text: `[    0.012755] Memory: 8MB stack / ${memGB}GB heap`, color: SITE_FAINT },
      { text: '[  OK  ] Started auditd.service', color: SITE_OK },
      { text: '[  OK  ] Mounted /research', color: SITE_OK },
      { text: '[  OK  ] Started decipher-psma@MDA.service', color: SITE_OK },
      { text: '[  OK  ] Started physics-gnn@DIVE.TAMU.service', color: SITE_OK },
      { text: '[  OK  ] Started sok-water@AGGIES.TAMU.service', color: SITE_OK },
      { text: '[  OK  ] Started build-agent@LM.service', color: SITE_OK },
      { text: '[  OK  ] Reached target cs-student.target', color: SITE_OK },
      { text: '[  OK  ] Started Builder.service', color: SITE_OK },
      { text: '[  OK  ] Reached target Builder.target', color: SITE_OK },
    ];
  }
  let i = 0;
  function writeNext() {
    if (i >= BOOT_MSGS.length) {
      neofetch(term);
      setTimeout(() => { writePrompt(term); if (onDone) onDone(); }, 80);
      return;
    }
    const msg = BOOT_MSGS[i];
    const str = `${msg.color}${msg.text}${ANSI_RESET}`;
    let ci = 0;
    function typeChar() {
      const end = Math.min(ci + 10, str.length);
      for (; ci < end; ci++) term.write(str[ci]);
      if (ci >= str.length) {
        term.write('\r\n');
        i++;
        setTimeout(writeNext, 10);
        return;
      }
      setTimeout(typeChar, 2 + Math.random() * 4);
    }
    typeChar();
  }
  writeNext();
}

function uptimeStr() {
  const s = Math.floor((Date.now() - pageLoadTime) / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${d} days, ${h} hours, ${m} minutes`;
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

const COMMANDS = ['whoami', 'hostname', 'date', 'uptime', 'uname', 'pwd', 'cat', 'ls', 'echo', 'clear', 'neofetch', 'resfetch', 'about', 'fortune', 'cowsay', 'help', 'matrix', 'vm', 'ai', 'ai-models', 'ai-model', 'ai-memory', 'history', 'crt', 'noise', 'weather', 'hn', 'md', 'wall', 'cv', 'search', 'google', 'ddg', 'myip', 'ping'];

function suggestCommand(input) {
  let best = null, bestDist = Infinity;
  for (const c of COMMANDS) {
    const d = levenshtein(input, c);
    if (d < bestDist && d <= 2) { bestDist = d; best = c; }
  }
  return best;
}

function visibleLen(s) {
  return s.replace(/\u001b\[[0-9;]*m/g, '').length;
}

function getBlueRedPhase() {
  const elapsed = (Date.now() - pageLoadTime) / 1000;
  const t = Math.sin(elapsed * Math.PI / 3);
  const mix = (t + 1) / 2;
  return [Math.round(mix * 255), 0, Math.round((1 - mix) * 255)];
}

// The ASCII portrait duplicated the thermal column, so it is hidden by
// default (the info block, color blocks and every command still work).
// Set to `true` to restore the classic terminal portrait in neofetch/boot.
const SHOW_TERMINAL_ART = false;

function neofetch(term) {
  const artHeight = ASCII_ART.length;
  const gap = 4;
  const maxArtW = Math.max(...ASCII_ART.map(visibleLen));

  const infoLines = [
    { label: '', value: `${ANSI_BOLD}${SITE_WHITE}db@dvxb.io${ANSI_RESET}` },
    { label: '', value: `${SITE_MUTED}─────────────────────────────────────────────────────────────────────────────────────────${ANSI_RESET}` },
    { label: 'Name', value: `Devkumar Banerjee` },
    { label: 'Education', value: `BS CS, Texas A&M (2029)` },
    { label: 'Research', value: `MD Anderson · DIVE Lab · AGGIES Lab · Houston Methodist · UTHSCSA` },
    { label: 'Work', value: `AI/SRE @ Lockheed Martin · SF Dev @ The Association` },
    { label: 'Skills', value: `Python · PyTorch · C · C++ · Java · Linux · Docker · Ansible · Keras · Streamlit` },
    { label: 'Certs', value: `GSEC · GFACT · AZ-900 · SC-900 · Linux Pro · CCST · ITF+ · RVFA` },
    { label: 'Shell', value: `fish 3.7` },
    { label: 'Uptime', value: uptimeStr() },
    { label: '', value: `${SITE_MUTED}─────────────────────────────────────────────────────────────────────────────────────────${ANSI_RESET}` },
    { label: '', value: `${ANSI_BOLD}${SITE_WHITE}Try:${ANSI_RESET} matrix · vm · ai · weather · hn · md · wall` },
    { label: '', value: `${SITE_MUTED}type${ANSI_RESET} \`${SITE_WHITE}help${ANSI_RESET}\` ${SITE_MUTED}for the full command list${ANSI_RESET}` },
  ];

  if (SHOW_TERMINAL_ART) {
    for (let i = 0; i < Math.max(artHeight + 2, infoLines.length + 2); i++) {
      const line = ASCII_ART[i] || '';
      const coloredArt = i < artHeight ? line : ' '.repeat(maxArtW);
      const infoIdx = i - 2;
      let infoPart = '';
      if (infoIdx >= 0 && infoIdx < infoLines.length) {
        const info = infoLines[infoIdx];
        infoPart = `${' '.repeat(gap)}${info.label ? `${SITE_LABEL}${info.label}${ANSI_RESET}: ` : ''}${info.value}`;
      }
      term.writeln(coloredArt + infoPart);
    }
  } else {
    // Portrait hidden — render a compact banner + the info block instead.
    term.writeln(`${ANSI_BOLD}${SITE_WHITE}db@dvxb.io${ANSI_RESET} ${SITE_MUTED}· neofetch (portrait shown in thermal column)${ANSI_RESET}`);
    for (const info of infoLines.slice(1)) {
      term.writeln(`${info.label ? `${SITE_LABEL}${info.label}${ANSI_RESET}: ` : ''}${info.value}`);
    }
  }

  term.writeln('');
  const phase = getBlueRedPhase();
  const bPhase = phase.map(c => Math.min(255, Math.round(c * 1.3)));
  const blockColors = [
    [0,0,0],[200,50,50],[50,180,50],[180,180,50],
    phase,
    [180,50,180],[50,180,180],[200,200,200],
    [80,80,80],[255,80,80],[80,255,80],[255,255,80],
    bPhase,
    [255,80,255],[80,255,255],[255,255,255],
  ];
  let blocksRow1 = ' '.repeat(maxArtW + gap);
  let blocksRow2 = ' '.repeat(maxArtW + gap);
  blockColors.slice(0, 8).forEach(([r,g,b]) => { blocksRow1 += `${' '.repeat(2)}${colorBlock(r,g,b)}${' '.repeat(2)}`; });
  blockColors.slice(8, 16).forEach(([r,g,b]) => { blocksRow2 += `${' '.repeat(2)}${colorBlock(r,g,b)}${' '.repeat(2)}`; });
  term.writeln(blocksRow1);
  term.writeln(blocksRow2);
}

const resfetch = neofetch;

function helpText(term) {
  const cmds = [
    ['whoami', 'Display current user'],
    ['hostname', 'Show system hostname'],
    ['date', 'Show current date/time'],
    ['uptime', 'Live session uptime'],
    ['uname [-a]', 'Print system information'],
    ['pwd', 'Print working directory'],
    ['cat <file>', 'Display file contents'],
    ['ls [path]', 'List directory contents'],
    ['echo <text>', 'Print text'],
    ['clear', 'Clear terminal'],
    ['neofetch', 'Display system & resume info'],
    ['about', 'Show a longer bio about me'],
    ['cv', 'Alias for neofetch'],
    ['resfetch', 'Alias for neofetch'],
    ['fortune', 'Random programming quote'],
    ['cowsay <msg>', 'Cow says your message'],
    ['matrix', 'Toggle matrix rain overlay'],
    ['vm', 'Boot Buildroot Linux VM'],
    ['crt', 'Toggle CRT scanline overlay'],
    ['noise', 'Toggle noise texture overlay'],
    ['history', 'Show command history'],
    ['weather [-f] [city]', 'Live weather via Worker proxy (-f °F)'],
    ['hn', 'Show Hacker News top stories'],
    ['md <url>', 'Render markdown from URL'],
    ['wall [msg]', 'View/post on global guestbook wall'],
    ['ai <prompt>', 'Portfolio AI assistant (Groq/Local)'],
    ['ai web <q>', 'Live Web-augmented AI search'],
    ['search <q>', 'Live web search via Worker'],
    ['myip', 'Show public IP, geo location & latency'],
    ['ai-models', 'List AI models'],
    ['ai-model <id>', 'Switch AI model (0-5)'],
    ['ai-memory', 'Show AI assistant conversation memory'],
    ['help', 'Show this help'],
  ];
  term.writeln(`${ANSI_BOLD}${SITE_WHITE}Available commands${ANSI_RESET}`);
  term.writeln(`${SITE_MUTED}────────────────────${ANSI_RESET}`);
  cmds.forEach(([cmd, desc]) => {
    term.writeln(`  ${SITE_GREEN}${cmd.padEnd(14)}${ANSI_RESET}${SITE_WHITE}${desc}${ANSI_RESET}`);
  });
}

async function getLocation() {
  try {
    const pos = await new Promise((res, rej) => {
      if (!navigator.geolocation) { rej('no geo'); return; }
      navigator.geolocation.getCurrentPosition(p => res(p), () => rej('denied'), { timeout: 8000, enableHighAccuracy: false });
    });
    const geoResp = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`,
      { headers: { 'User-Agent': navigator.userAgent } }
    );
    const geoData = await geoResp.json();
    const a = geoData.address || {};
    return {
      lat: pos.coords.latitude,
      lon: pos.coords.longitude,
      city: a.city || a.town || a.village || a.county || null,
      region: a.state || null,
      country: a.country_code || null,
    };
  } catch {
    const ipResp = await fetch('https://ipapi.co/json/');
    const ipData = await ipResp.json();
    return {
      lat: ipData.latitude,
      lon: ipData.longitude,
      city: ipData.city || null,
      region: ipData.region || null,
      region_code: ipData.region_code || null,
      country: ipData.country_code || null,
    };
  }
}

async function weatherCommand(term, args) {
  const isF = args.includes('-f');
  term.writeln(`${SITE_MUTED}Fetching location...${ANSI_RESET}`);
  let loc;
  if (_prefetchedLocation) {
    loc = _prefetchedLocation;
  } else {
    try { loc = await getLocation(); }
    catch {
      term.writeln(`${SITE_ERR}Could not determine location.${ANSI_RESET}`);
      term.writeln(`${SITE_FAINT}  .       .       .${ANSI_RESET}`);
      term.writeln(`${SITE_FAINT}    .   .   .   .${ANSI_RESET}`);
      term.writeln(`${SITE_FAINT}  .  +  .  +  .${ANSI_RESET}`);
      term.writeln(`${SITE_FAINT}    .   .   .   .${ANSI_RESET}`);
      term.writeln(`${SITE_FAINT}  .       .       .${ANSI_RESET}`);
      writePrompt(term); return;
    }
  }
  const lat = loc.lat.toFixed(4);
  const lon = loc.lon.toFixed(4);
  const state = loc.region_code || loc.region;
  const locStr = loc.city && state
    ? `${loc.city}, ${state} <${lat}, ${lon}>`
    : `<${lat}, ${lon}>`;

  if (args.includes('--debug')) {
    term.writeln(`${SITE_LABEL}loc:${ANSI_RESET} ${SITE_WHITE}${JSON.stringify(loc)}${ANSI_RESET}`);
    term.writeln(`${SITE_LABEL}locStr:${ANSI_RESET} ${SITE_WHITE}${locStr}${ANSI_RESET}`);
    term.writeln(`${SITE_LABEL}prefetched:${ANSI_RESET} ${SITE_WHITE}${_prefetchedLocation !== null}${ANSI_RESET}`);
    term.writeln(`${SITE_MUTED}Fetching raw ipapi response...${ANSI_RESET}`);
    try {
      const r = await fetch('https://ipapi.co/json/');
      const d = await r.json();
      for (const k of ['city','region','region_code','country','country_code','latitude','longitude']) {
        term.writeln(`  ${SITE_FAINT}${k}:${ANSI_RESET} ${SITE_GREEN}${JSON.stringify(d[k])}${ANSI_RESET}`);
      }
    } catch (e) {
      term.writeln(`${SITE_ERR}ipapi.co error: ${e.message}${ANSI_RESET}`);
    }
    writePrompt(term);
    return;
  }

  term.writeln(`${SITE_MUTED}Fetching weather for ${locStr}...${ANSI_RESET}`);
  try {
    const wResp = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&daily=temperature_2m_max,temperature_2m_min&timezone=auto`);
    const wData = await wResp.json();
    const cw = wData.current_weather;
    const tempUnit = isF ? '°F' : '°C';
    const temp = isF ? (cw.temperature * 9 / 5 + 32).toFixed(1) : cw.temperature;
    const wmoCodes = {
      0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
      45: 'Foggy', 48: 'Rime fog', 51: 'Light drizzle', 53: 'Moderate drizzle',
      55: 'Dense drizzle', 61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
      71: 'Slight snow', 73: 'Moderate snow', 75: 'Heavy snow',
      80: 'Slight showers', 81: 'Moderate showers', 82: 'Violent showers',
      95: 'Thunderstorm', 96: 'Thunderstorm w/ slight hail', 99: 'Thunderstorm w/ heavy hail',
    };
    const cond = wmoCodes[cw.weathercode] || `Code ${cw.weathercode}`;
    const windKmh = (cw.windspeed * 3.6).toFixed(1);
    const hi = isF ? (wData.daily.temperature_2m_max[0] * 9/5 + 32).toFixed(1) : wData.daily.temperature_2m_max[0];
    const lo = isF ? (wData.daily.temperature_2m_min[0] * 9/5 + 32).toFixed(1) : wData.daily.temperature_2m_min[0];
    term.writeln(`${SITE_CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━${ANSI_RESET}`);
    term.writeln(`${SITE_BLUE}  ${locStr}${ANSI_RESET}`);
    term.writeln(`${SITE_CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━${ANSI_RESET}`);
    term.writeln(`${SITE_WHITE}  ${cond}   ${temp}${tempUnit}${ANSI_RESET}`);
    term.writeln(`${SITE_MUTED}  H: ${hi}${tempUnit}  L: ${lo}${tempUnit}${ANSI_RESET}`);
    term.writeln(`${SITE_MUTED}  Wind: ${windKmh} km/h${ANSI_RESET}`);
    term.writeln(`${SITE_CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━${ANSI_RESET}`);
  } catch {
    term.writeln(`${SITE_ERR}Failed to fetch weather data${ANSI_RESET}`);
  }
  writePrompt(term);
}



function timeAgo(epoch) {
  const diff = Date.now() / 1000 - epoch;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
  return `${Math.floor(diff / 2592000)}mo ago`;
}

function stripHtml(html) {
  if (!html) return '';
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || '';
}

function renderComment(term, item, depth) {
  if (!item || item.deleted || item.dead) return;
  const indent = '  '.repeat(depth);
  const ago = item.time ? timeAgo(item.time) : '';
  term.writeln(`${indent}${SITE_GREEN}${item.by || 'anonymous'}${ANSI_RESET} ${SITE_FAINT}${ago}${ANSI_RESET}`);
  if (item.text) {
    const text = stripHtml(item.text);
    const wrap = Math.max(20, 72 - indent.length);
    const lines = text.match(new RegExp(`.{1,${wrap}}`, 'g')) || [];
    lines.forEach(line => term.writeln(`${indent}${line}`));
  }
  if (depth < 2 && item._replies && item._replies.length > 0) {
    for (const reply of item._replies) {
      renderComment(term, reply, depth + 1);
    }
  }
}

async function hnCommand(term, args) {
  if (args.length > 0) {
    const idx = parseInt(args[0], 10);
    if (isNaN(idx) || idx < 1 || idx > _hnItems.length) {
      term.writeln(`${SITE_ERR}hn: invalid index${ANSI_RESET}`);
      writePrompt(term);
      return;
    }
    const item = _hnItems[idx - 1];
    if (!item) {
      term.writeln(`${SITE_ERR}hn: item not found${ANSI_RESET}`);
      writePrompt(term);
      return;
    }
    term.writeln(`${SITE_MUTED}Fetching story #${item.id}...${ANSI_RESET}`);
    try {
      const storyResp = await fetch(`https://hacker-news.firebaseio.com/v0/item/${item.id}.json`);
      const story = await storyResp.json();
      if (!story) throw new Error('empty');

      term.writeln(`${ANSI_BOLD}${SITE_WHITE}${story.title}${ANSI_RESET}`);
      const by = story.by || 'anonymous';
      const pts = story.score || 0;
      const cmts = story.descendants || 0;
      const ago = story.time ? timeAgo(story.time) : '';
      term.writeln(`${SITE_MUTED}by ${SITE_GREEN}${by}${SITE_MUTED} | ${pts} points | ${cmts} comments | ${ago}${ANSI_RESET}`);
      if (story.url) {
        term.writeln(`${SITE_BLUE}${story.url}${ANSI_RESET}`);
      }
      if (story.text) {
        term.writeln('');
        term.writeln(stripHtml(story.text));
      }

      if (story.kids && story.kids.length > 0) {
        term.writeln('');
        const commentIds = story.kids.slice(0, 10);
        const comments = await Promise.all(
          commentIds.map(id =>
            fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`).then(r => r.json())
          )
        );
        for (const comment of comments) {
          if (comment && comment.kids && comment.kids.length > 0) {
            const replyIds = comment.kids.slice(0, 3);
            comment._replies = (await Promise.all(
              replyIds.map(id =>
                fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`).then(r => r.json())
              )
            )).filter(Boolean);
          }
        }
        for (const comment of comments) {
          renderComment(term, comment, 0);
          term.writeln('');
        }
      } else {
        term.writeln(`${SITE_MUTED}No comments yet${ANSI_RESET}`);
      }
    } catch {
      term.writeln(`${SITE_ERR}Failed to fetch story #${item.id}${ANSI_RESET}`);
    }
    writePrompt(term);
    return;
  }

  term.writeln(`${SITE_MUTED}Fetching top stories...${ANSI_RESET}`);
  try {
    const idsResp = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
    const ids = await idsResp.json();
    const topIds = ids.slice(0, 30);
    const items = await Promise.all(topIds.map(id =>
      fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`).then(r => r.json())
    ));
    _hnItems = items;
    term.writeln(`${SITE_CYAN}┌────┬──────────────────────────────────────────────────┬───────┬────────┐${ANSI_RESET}`);
    term.writeln(`${SITE_CYAN}│${SITE_FAINT} #  ${SITE_CYAN}│${SITE_FAINT} Title                                            ${SITE_CYAN}│${SITE_FAINT} Score ${SITE_CYAN}│${SITE_FAINT} Comments${SITE_CYAN}│${ANSI_RESET}`);
    term.writeln(`${SITE_CYAN}├────┼──────────────────────────────────────────────────┼───────┼────────┤${ANSI_RESET}`);
    items.forEach((item, i) => {
      if (!item) return;
      const num = String(i + 1).padStart(2);
      const title = (item.title || 'Untitled').slice(0, 48).padEnd(48);
      const score = String(item.score || 0).padStart(5);
      const comments = String(item.descendants || 0).padStart(6);
      term.writeln(`${SITE_CYAN}│${SITE_GREEN}${num} ${SITE_CYAN}│${SITE_WHITE} ${title} ${SITE_CYAN}│${SITE_MUTED} ${score}${SITE_CYAN}│${SITE_MUTED} ${comments}${SITE_CYAN}│${ANSI_RESET}`);
    });
    term.writeln(`${SITE_CYAN}└────┴──────────────────────────────────────────────────┴───────┴────────┘${ANSI_RESET}`);
    term.writeln(`${SITE_MUTED}Type ${SITE_WHITE}hn <number>${SITE_MUTED} to view a story${ANSI_RESET}`);
  } catch {
    term.writeln(`${SITE_ERR}Failed to fetch Hacker News${ANSI_RESET}`);
  }
  writePrompt(term);
}

function mdCommand(term, args) {
  if (!args.length) { term.writeln(`${SITE_ERR}md: missing URL${ANSI_RESET}`); writePrompt(term); return; }
  let url = args[0];
  if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'https://' + url;
  term.writeln(`${SITE_MUTED}Opening ${url} in markdown viewer...${ANSI_RESET}`);
  try {
    const existing = document.getElementById('md-viewer-iframe');
    if (existing) existing.remove();
    const iframe = document.createElement('iframe');
    iframe.id = 'md-viewer-iframe';
    iframe.src = `md-viewer.html?url=${encodeURIComponent(url)}`;
    iframe.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:9999;border:none;background:oklch(0 0 0)';
    document.body.appendChild(iframe);
    const closeBtn = document.createElement('button');
    closeBtn.id = 'md-viewer-close';
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = 'position:fixed;top:16px;right:16px;z-index:10000;width:36px;height:36px;border-radius:50%;border:1px solid oklch(0.3 0.02 260);background:oklch(0.1 0.01 260 / 0.8);color:oklch(0.9 0.01 260);font-size:18px;cursor:pointer;backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center';
    closeBtn.addEventListener('click', () => { iframe.remove(); closeBtn.remove(); });
    document.body.appendChild(closeBtn);
    term.writeln(`${SITE_GREEN}md viewer opened. Press ✕ or Esc to close${ANSI_RESET}`);
    document.addEventListener('keydown', function onEsc(e) { if (e.key === 'Escape') { iframe.remove(); closeBtn.remove(); document.removeEventListener('keydown', onEsc); } });
  } catch {
    term.writeln(`${SITE_ERR}Failed to open markdown viewer${ANSI_RESET}`);
  }
  writePrompt(term);
}

function executeCommand(input, term) {
  const trimmed = input.trim();
  if (!trimmed) { writePrompt(term); return; }

  // Pipe support: cmd1 | cmd2
  if (trimmed.includes('|')) {
    const segments = trimmed.split('|').map(s => s.trim());
    let captured = '';
    const capTerm = { write: s => { captured += s; }, writeln: s => { captured += s + '\n'; } };
    for (let i = 0; i < segments.length; i++) {
      if (i < segments.length - 1) {
        executeCommand(segments[i], capTerm);
      } else {
        executeCommand(segments[i] + ' "' + captured.trimEnd() + '"', term);
      }
    }
    writePrompt(term);
    return;
  }

  const parts = trimmed.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1).map(a => a.replace(/^"(.*)"$/, '$1'));

  switch (cmd) {
    case 'whoami':
      term.writeln(`${SITE_WHITE}db${ANSI_RESET}`);
      break;
    case 'hostname':
      term.writeln(`${SITE_CYAN}dvxb.io${ANSI_RESET}`);
      break;
    case 'date':
      term.writeln(`${SITE_WHITE}${new Date().toString()}${ANSI_RESET}`);
      break;
    case 'uptime':
      term.writeln(`\r${SITE_GREEN} up ${uptimeStr()}${ANSI_RESET}`);
      break;
    case 'pwd':
      term.writeln(`${SITE_BLUE}/home/db${ANSI_RESET}`);
      break;
    case 'uname':
      if (args.includes('-a')) {
        term.writeln(`${SITE_WHITE}Linux dvxb.io 7.x-LTS #1 dvxb v2 x86_64 GNU/Linux${ANSI_RESET}`);
      } else {
        term.writeln(`${SITE_WHITE}Linux${ANSI_RESET}`);
      }
      break;
    case 'cat':
      if (!args.length) { term.writeln(`${SITE_ERR}cat: missing operand${ANSI_RESET}`); break; }
      const catPath = args[0].startsWith('/') ? args[0] : `/home/db/${args[0]}`;
      const catContent = vfs.get(catPath);
      if (catContent === undefined) {
        term.writeln(`${SITE_ERR}cat: ${args[0]}: No such file or directory${ANSI_RESET}`);
      } else {
        catContent.split('\n').forEach(l => term.writeln(`${SITE_WHITE}${l}${ANSI_RESET}`));
      }
      break;
    case 'ls':
      const lsPath = args[0] || '/home/db/';
      const fullPath = lsPath.startsWith('/') ? lsPath : `/home/db/${lsPath}`;
      const lsEntry = vfs.get(fullPath);
      if (lsEntry === undefined) {
        term.writeln(`${SITE_ERR}ls: ${lsPath}: No such file or directory${ANSI_RESET}`);
      } else {
        lsEntry.split('\n').forEach(item => {
          const isLink = item.includes('.pdf');
          term.writeln(`${isLink ? SITE_RED : SITE_CYAN}${item}${ANSI_RESET}`);
        });
      }
      break;
    case 'echo':
      term.writeln(`${SITE_WHITE}${args.join(' ')}${ANSI_RESET}`);
      break;
    case 'clear':
      term.clear();
      break;
    case 'neofetch':
      neofetch(term);
      break;
    case 'resfetch':
      neofetch(term);
      break;
    case 'about':
      term.writeln(`${SITE_WHITE}Devkumar Banerjee${ANSI_RESET}`);
      term.writeln(`${SITE_MUTED}───────────────${ANSI_RESET}`);
      term.writeln(`${SITE_WHITE}CS Honors @ Texas A&M University${ANSI_RESET}`);
      term.writeln(`Builder of terminal-themed portfolios with ${SITE_CYAN}xterm.js${ANSI_RESET}`);
      term.writeln(`frosted glass UI, ${SITE_CYAN}Three.js${ANSI_RESET} particle effects, and a`);
      term.writeln(`local AI assistant running ${SITE_CYAN}Transformers.js${ANSI_RESET} in-browser`);
      term.writeln(`(WASM/WebGPU). Systems tinkerer, researcher, and open-source`);
      term.writeln(`contributor. Interested in ML infrastructure, developer tooling,`);
      term.writeln(`and building things that feel alive.`);
      term.writeln(`cv: ${SITE_BLUE}https://dvxb.io${ANSI_RESET}`);
      term.writeln(`gh: ${SITE_BLUE}https://github.com/aptitudepi${ANSI_RESET}`);
      break;
    case 'fortune':
      if (FORTUNES.length) {
        term.writeln(`${SITE_WHITE}${FORTUNES[Math.floor(Math.random() * FORTUNES.length)]}${ANSI_RESET}`);
      } else {
        term.writeln(`${SITE_ERR}No fortunes available${ANSI_RESET}`);
      }
      break;
    case 'cowsay':
      const cowMsg = args.join(' ') || 'Moo!';
      const MAX_W = 58;
      const words = cowMsg.split(' ');
      const lines = [];
      let cur = '';
      for (const w of words) {
        if (cur && cur.length + w.length + 1 > MAX_W) { lines.push(cur); cur = ''; }
        cur = cur ? cur + ' ' + w : w;
      }
      if (cur) lines.push(cur);
      if (!lines.length) lines.push('');
      const maxW = Math.min(Math.max(...lines.map(l => l.length)), MAX_W);
      const bar = '\u2500'.repeat(maxW + 2);
      const side = '\u2502';
      term.writeln(` ${SITE_GREEN} ${bar}${ANSI_RESET}`);
      for (const l of lines) {
        term.writeln(` ${SITE_GREEN}${side} ${l.padEnd(maxW)} ${side}${ANSI_RESET}`);
      }
      term.writeln(` ${SITE_GREEN} ${bar}${ANSI_RESET}`);
      term.writeln(`${SITE_GREEN}   \\   ^__^${ANSI_RESET}`);
      term.writeln(`${SITE_GREEN}    \\  (oo)\\_______${ANSI_RESET}`);
      term.writeln(`${SITE_GREEN}       (__)\\       )\\/\\${ANSI_RESET}`);
      term.writeln(`${SITE_GREEN}           ||----w |${ANSI_RESET}`);
      term.writeln(`${SITE_GREEN}           ||     ||${ANSI_RESET}`);
      break;
    case 'help':
      helpText(term);
      break;
    case 'matrix':
      if (typeof window.stopMatrixRain === 'function' && typeof window.isMatrixActive === 'function' && window.isMatrixActive()) {
        window.stopMatrixRain();
        term.writeln(`${SITE_MUTED}Matrix rain stopped${ANSI_RESET}`);
      } else if (typeof window.startMatrixRain === 'function') {
        window.startMatrixRain();
        term.writeln(`${SITE_GREEN}Matrix rain started. Press Escape to exit.${ANSI_RESET}`);
      } else {
        term.writeln(`${SITE_ERR}Matrix rain module not loaded${ANSI_RESET}`);
      }
      break;
    case 'vm':
      term.writeln(`${SITE_MUTED}Loading Buildroot Linux VM...${ANSI_RESET}`);
      if (typeof window.bootVM === 'function') {
        window.bootVM(term);
      } else {
        term.writeln(`${SITE_ERR}VM module not loaded${ANSI_RESET}`);
      }
      break;
    case 'ai':
    case 'llm':
      generateOutput(args.join(' '), term).then(() => writePrompt(term));
      return;
    case 'ai-models':
      showModelSelector(term);
      break;
    case 'ai-model':
      if (args.length) {
        switchModel(args[0], term);
      } else {
        showModelSelector(term);
      }
      break;
    case 'search':
    case 'google':
    case 'ddg': {
      const q = args.join(' ');
      if (!q) {
        term.writeln(`${SITE_MUTED}Usage: search <query>${ANSI_RESET}`);
        break;
      }
      term.writeln(`${SITE_FAINT}Searching web via Cloudflare Worker...${ANSI_RESET}`);
      fetch(`https://0.supernovadkb.workers.dev/search?q=${encodeURIComponent(q)}`)
        .then(res => res.json())
        .then(data => {
          if (!data.results || !data.results.length) {
            term.writeln(`${SITE_MUTED}No search results found.${ANSI_RESET}`);
          } else {
            term.writeln(`${SITE_GREEN}\x1b[1mSearch Results for "${q}":\x1b[0m${ANSI_RESET}`);
            data.results.forEach((r, i) => {
              term.writeln(`  ${SITE_GREEN}[${i + 1}] ${r.title}${ANSI_RESET}`);
              term.writeln(`      ${SITE_FAINT}${r.snippet}${ANSI_RESET}`);
              term.writeln(`      \x1b[34m\x1b[4m${r.url}\x1b[0m\n`);
            });
          }
          writePrompt(term);
        })
        .catch(err => {
          term.writeln(`${SITE_ERR}Search error: ${err.message}${ANSI_RESET}`);
          writePrompt(term);
        });
      return;
    }
    case 'myip':
    case 'ping': {
      term.writeln(`${SITE_FAINT}Pinging Cloudflare Worker gateway...${ANSI_RESET}`);
      const t0 = performance.now();
      fetch('https://0.supernovadkb.workers.dev/ip')
        .then(res => res.json())
        .then(info => {
          const latency = Math.round(performance.now() - t0);
          term.writeln(`${SITE_GREEN}\x1b[1mNetwork Diagnostics & IP Location:\x1b[0m${ANSI_RESET}`);
          term.writeln(`  \x1b[36mPublic IP:\x1b[0m ${info.ip}`);
          term.writeln(`  \x1b[36mLocation:\x1b[0m ${info.city}, ${info.country} (${info.continent})`);
          term.writeln(`  \x1b[36mISP / ASN:\x1b[0m ${info.asOrganization} (AS${info.asn})`);
          term.writeln(`  \x1b[36mLatency:\x1b[0m ${latency}ms`);
          term.writeln(`  \x1b[36mRay ID:\x1b[0m ${info.ray}`);
          writePrompt(term);
        })
        .catch(err => {
          term.writeln(`${SITE_ERR}Ping error: ${err.message}${ANSI_RESET}`);
          writePrompt(term);
        });
      return;
    }
    case 'history':
      if (CMD_HISTORY.length === 0) {
        term.writeln(`${SITE_MUTED}No commands in history${ANSI_RESET}`);
      } else {
        for (let i = 0; i < CMD_HISTORY.length; i++) {
          const idx = String(i + 1).padStart(3, ' ');
          term.writeln(`${SITE_FAINT}${idx}  ${ANSI_RESET}${SITE_WHITE}${CMD_HISTORY[i]}${ANSI_RESET}`);
        }
      }
      break;
    case 'cv':
      neofetch(term);
      break;
    case 'crt': {
      const el = document.getElementById('crt-overlay');
      if (el) {
        el.classList.toggle('active');
        term.writeln(`${SITE_GREEN}crt overlay ${el.classList.contains('active') ? 'enabled' : 'disabled'}${ANSI_RESET}`);
      }
      break;
    }
    case 'noise': {
      const el = document.getElementById('noise-overlay');
      if (el) {
        el.classList.toggle('active');
        term.writeln(`${SITE_GREEN}noise overlay ${el.classList.contains('active') ? 'enabled' : 'disabled'}${ANSI_RESET}`);
      }
      break;
    }
    case 'weather':
      weatherCommand(term, args);
      return;
    case 'hn':
      hnCommand(term, args);
      return;
    case 'md':
      mdCommand(term, args);
      return;
    case 'wall':
    case 'guestbook': {
      const msg = args.join(' ');
      if (!msg) {
        term.writeln(`${SITE_FAINT}Fetching global visitor wall...${ANSI_RESET}`);
        fetch('https://0.supernovadkb.workers.dev/wall')
          .then(res => res.json())
          .then(data => {
            const posts = data.posts || [];
            term.writeln(`${SITE_GREEN}\x1b[1mdvxb.io Global Visitor Guestbook & AI Wall:\x1b[0m${ANSI_RESET}`);
            if (!posts.length) {
              term.writeln(`${SITE_MUTED}No entries yet. Be the first to leave a message using: wall <your message>${ANSI_RESET}`);
            } else {
              posts.forEach(p => {
                term.writeln(`  ${SITE_CYAN}[${p.timestamp}] ${p.name}:${ANSI_RESET} "${p.message}"`);
                if (p.aiReply) {
                  term.writeln(`      ${SITE_GREEN}AI Signature Reply:${ANSI_RESET} ${SITE_FAINT}${p.aiReply}${ANSI_RESET}`);
                }
              });
            }
            term.writeln(`\n${SITE_MUTED}Tip: Leave your own message using: wall <message>${ANSI_RESET}`);
            writePrompt(term);
          })
          .catch(err => {
            term.writeln(`${SITE_ERR}Failed to load wall: ${err.message}${ANSI_RESET}`);
            writePrompt(term);
          });
        return;
      }
      term.writeln(`${SITE_FAINT}Posting message to global wall & generating AI reply...${ANSI_RESET}`);
      fetch('https://0.supernovadkb.workers.dev/wall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Terminal Visitor', message: msg })
      })
        .then(res => res.json())
        .then(data => {
          if (data.post) {
            term.writeln(`${SITE_GREEN}\x1b[1mMessage posted to global wall!${ANSI_RESET}`);
            term.writeln(`  ${SITE_CYAN}${data.post.name}:${ANSI_RESET} "${data.post.message}"`);
            term.writeln(`  ${SITE_GREEN}AI Reply:${ANSI_RESET} ${data.post.aiReply}`);
          } else {
            term.writeln(`${SITE_ERR}Failed to post: ${data.error || 'Unknown error'}${ANSI_RESET}`);
          }
          writePrompt(term);
        })
        .catch(err => {
          term.writeln(`${SITE_ERR}Wall post error: ${err.message}${ANSI_RESET}`);
          writePrompt(term);
        });
      return;
    }
    case 'ai-memory': {
      import('./memory.js').then(mem => {
        const history = mem.getStoredHistory();
        term.writeln(`${SITE_GREEN}\x1b[1mPortfolio AI Assistant Memory & Conversation Turns:\x1b[0m${ANSI_RESET}`);
        if (!history.length) {
          term.writeln(`${SITE_MUTED}No conversation history stored.${ANSI_RESET}`);
        } else {
          history.forEach((h, i) => {
            term.writeln(`  ${SITE_FAINT}[${i + 1}] ${h.role.toUpperCase()}:${ANSI_RESET} ${h.content}`);
          });
        }
        writePrompt(term);
      });
      return;
    }
    default: {
      const suggestion = suggestCommand(cmd);
      if (suggestion) {
        term.writeln(`${SITE_ERR}${cmd}: command not found${ANSI_RESET}`);
        term.writeln(`${SITE_MUTED}Did you mean \`${SITE_WHITE}${suggestion}${SITE_MUTED}\`?${ANSI_RESET}`);
      } else {
        term.writeln(`${SITE_ERR}${cmd}: command not found${ANSI_RESET}`);
      }
      break;
    }
  }
  writePrompt(term);
}

window.executeTerminalCommand = executeCommand;

export { ASCII_ART, vfs, RESUME, CMD_HISTORY, BOOT_MSGS, SHOW_TERMINAL_ART, executeCommand, bootSequence, neofetch, resfetch, writePrompt, uptimeStr, ansiRGB, ANSI_RESET, ANSI_BOLD, SITE_GREEN, SITE_CYAN, SITE_WHITE, SITE_BLUE, SITE_MUTED, SITE_OK, SITE_ERR, SITE_LABEL, SITE_FAINT, COMMANDS };
