// @ts-types="npm:@types/fluent-ffmpeg@2.1.27"
import ffmpeg from "fluent-ffmpeg";
import { image, video } from "@hk/photographer-toolbox";
import { getTotalFrames } from "./lib.ts";
import ytdl from "@distube/ytdl-core";
import fs from "node:fs";

ytdl("https://youtu.be/-b1FogYHTZc").pipe(fs.createWriteStream("video.mp4"));
