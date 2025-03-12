// @ts-types="npm:@types/fluent-ffmpeg@2.1.27"
import ffmpeg from "fluent-ffmpeg";
import fs from "node:fs";
import ytdl from "@distube/ytdl-core";
import type { API, DownloadProgress } from "../src/api.ts";
import type { Progress } from "../src/api.ts";
import { video } from "@hk/photographer-toolbox";

export function getTotalFrames(videoPath: string): Promise<number | undefined> {
  return video
    .readMainVideoMetadata(videoPath)
    .then((data) => data?.numberOfFrames);
}

export async function getVideoName(url: string): Promise<string> {
  try {
    const info = await ytdl.getInfo(url);
    return info.videoDetails.title;
  } catch (error: unknown) {
    // Type assertion for error
    const err = error as Error;
    throw new Error(`Failed to get video name: ${err.message}`);
  }
}

export class YouTubeDownloader implements API {
  private lastVideoProgressCall: number = 0;
  private lastAudioProgressCall: number = 0;
  private readonly PROGRESS_THROTTLE_MS: number = 300; // 0.3 seconds

  async getAvailableResolutions(url: string) {
    const info = await ytdl.getInfo(url);

    // Get unique video formats with video+audio or video only
    const formats = info.formats
      .filter((format) => format.qualityLabel) // Only get video formats
      .map((format) => ({
        qualityLabel: format.qualityLabel,
        fps: format.fps,
        hasAudio: format.hasAudio,
      }))
      .filter(
        (
          value,
          index,
          self // Remove duplicates
        ) =>
          index === self.findIndex((t) => t.qualityLabel === value.qualityLabel)
      )
      .sort((a, b) => {
        // Sort by resolution (height) in descending order
        const aHeight = parseInt(a.qualityLabel);
        const bHeight = parseInt(b.qualityLabel);
        return bHeight - aHeight;
      });

    return formats;
  }

  async downloadVideo(
    url: string,
    quality: string,
    startCallback?: () => void,
    downloadVideoProgressCallback?: (progress: DownloadProgress) => void,
    downloadAudioProgressCallback?: (progress: DownloadProgress) => void,
    mergeProgressCallback?: (progress: Progress) => void,
    endCallback?: () => void
  ): Promise<boolean> {
    // Get video info
    const info = await ytdl.getInfo(url);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const outputFilename = `youtube-video-${timestamp}.mp4`;

    // Get the video format matching the selected quality
    const videoFormat = ytdl.chooseFormat(info.formats, {
      quality: "highestvideo",
      filter: (format) => format.qualityLabel === quality,
    });

    // Check if the video format already has audio
    if (videoFormat.hasAudio) {
      console.error(`Downloading ${quality} video with audio...`);
      const videoStream = ytdl(url, { format: videoFormat });
      let videoDownloaded = 0;

      videoStream.on("progress", (_, downloaded, total) => {
        videoDownloaded += downloaded;
        const now = Date.now();
        if (now - this.lastVideoProgressCall >= this.PROGRESS_THROTTLE_MS) {
          downloadVideoProgressCallback?.({
            downloaded: videoDownloaded,
            total,
          });
          this.lastVideoProgressCall = now;
        }
      });

      const writeStream = fs.createWriteStream(outputFilename);
      videoStream.pipe(writeStream);

      return new Promise((resolve, reject) => {
        writeStream.on("finish", () => {
          console.error(`Successfully downloaded to ${outputFilename}`);
          endCallback?.();
          resolve(true);
        });
        writeStream.on("error", (err) => {
          console.error("Error downloading video:", err);
          reject(err);
        });
      });
    }

    // If video doesn't have audio, proceed with the original separate download and merge process
    console.error(`Downloading ${quality} video and audio separately...`);

    // Get the highest quality audio format
    const audioFormat = ytdl.chooseFormat(info.formats, {
      quality: "highestaudio",
      filter: "audioonly",
    });

    let videoDownloaded = 0;
    let audioDownloaded = 0;

    const videoStream = ytdl(url, { format: videoFormat });
    const audioStream = ytdl(url, { format: audioFormat });
    videoStream.once("readable", () => {
      startCallback?.();
    });
    videoStream.on("progress", (_, downloaded, total) => {
      videoDownloaded += downloaded;
      const now = Date.now();
      if (now - this.lastVideoProgressCall >= this.PROGRESS_THROTTLE_MS) {
        downloadVideoProgressCallback?.({
          downloaded: videoDownloaded,
          total,
        });
        this.lastVideoProgressCall = now;
      }
    });

    audioStream.on("progress", (_, downloaded, total) => {
      audioDownloaded += downloaded;
      const now = Date.now();
      if (now - this.lastAudioProgressCall >= this.PROGRESS_THROTTLE_MS) {
        downloadAudioProgressCallback?.({
          downloaded: audioDownloaded,
          total,
        });
        this.lastAudioProgressCall = now;
      }
    });

    videoStream.pipe(fs.createWriteStream("temp-video.mp4"));
    audioStream.pipe(fs.createWriteStream("temp-audio.mp4"));
    await Promise.all([
      new Promise((resolve) => videoStream.on("end", resolve)),
      new Promise((resolve) => audioStream.on("end", resolve)),
    ]);

    return new Promise((resolve, reject) => {
      console.error("Merging video and audio...");
      ffmpeg()
        .input("temp-video.mp4")
        .input("temp-audio.mp4")
        .outputOptions("-c:v copy")
        .outputOptions("-c:a aac")
        .save(outputFilename)
        .on("end", () => {
          fs.unlinkSync("temp-video.mp4");
          fs.unlinkSync("temp-audio.mp4");
          console.error(
            `Successfully downloaded and merged to ${outputFilename}.mp4`
          );
          endCallback?.();
          resolve(true);
        })
        // @ts-ignore - ffmpeg-fluent types are incomplete
        .on("progress", (progress) => {
          mergeProgressCallback?.(progress);
        })
        .on("error", (err) => {
          console.error("Error merging video and audio:", err);
          reject(err);
        });
    });
  }
}

// Export an instance of the class for easier usage
export const youtubeDownloader = new YouTubeDownloader();
