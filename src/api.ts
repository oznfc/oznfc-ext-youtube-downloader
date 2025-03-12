import type ytdl from "@distube/ytdl-core";

export type Progress = {
  frames: number;
  currentFps: number;
  currentKbps: number;
  targetSize: number;
  timemark: string;
};

export type DownloadProgress = {
  downloaded: number;
  total: number;
};

export interface API {
  getAvailableResolutions: (
    url: string
  ) => Promise<Pick<ytdl.videoFormat, "qualityLabel" | "fps" | "hasAudio">[]>;
  downloadVideo: (
    url: string,
    quality: string,
    startCallback?: () => void,
    downloadVideoProgressCallback?: (progress: DownloadProgress) => void,
    downloadAudioProgressCallback?: (progress: DownloadProgress) => void,
    mergeProgressCallback?: (progress: Progress) => void,
    endCallback?: () => void
  ) => Promise<boolean>;
}
