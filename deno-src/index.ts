import { expose } from "@kunkun/api/runtime/deno";
import { YouTubeDownloader } from "./lib.ts";

const downloader = new YouTubeDownloader();
expose(downloader);
