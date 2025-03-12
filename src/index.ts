import {
  Action,
  app,
  Child,
  clipboard,
  DenoCommand,
  expose,
  Form,
  fs,
  Icon,
  IconEnum,
  List,
  path,
  RPCChannel,
  shell,
  toast,
  ui,
  TemplateUiCommand,
  Markdown,
} from "@kksh/api/ui/template";
import type { API } from "./api";
import * as v from "valibot";

async function getRpcAPI() {
  const downloadDir = await path.downloadDir();
  const { rpcChannel, process, command } = await shell.createDenoRpcChannel<
    object,
    API
  >(
    "$EXTENSION/deno-src/index.ts",
    [],
    {
      allowAllEnv: true,
      allowAllFfi: true,
      allowAllRead: true,
      allowAllWrite: true,
      allowAllSys: true,
      allowAllRun: true,
      allowAllNet: true,
      cwd: downloadDir,
      env: {
        FFMPEG_PATH: "/opt/homebrew/bin/ffmpeg",
        FFPROBE_PATH: "/opt/homebrew/bin/ffprobe",
      },
    },
    {}
  );
  command.stderr.on("data", (data) => {
    console.warn(data);
    if (data.includes("Conversion failed!")) {
      toast.error("Conversion failed!");
    }
  });
  const api = rpcChannel.getAPI();
  return {
    api,
    rpcChannel,
    process,
    command,
  };
}

const formSchema = v.object({
  url: v.string(),
  resolutions: v.string(),
});

class DownloadYouTubeExtension extends TemplateUiCommand {
  private rpc?: {
    api: API;
    rpcChannel: RPCChannel<object, API>;
    process: Child;
    command: DenoCommand<string>;
  };

  // Add properties to track download progress
  private videoProgress = 0;
  private audioProgress = 0;
  private mergeProgress = 0;
  private isDownloading = false;
  private mergeStarted = false;

  private updateTotalProgress() {
    if (!this.isDownloading) return;

    // Downloads take up 50% of total progress (25% each)
    const downloadProgress = (this.videoProgress + this.audioProgress) * 0.25;
    console.log(
      "this.audioProgress",
      this.audioProgress,
      "this.videoProgress",
      this.videoProgress
    );
    // Merge takes up the other 50%
    const totalProgress = downloadProgress + this.mergeProgress;
    ui.setProgressBar(Math.min(totalProgress, 0.99) * 100);
  }

  async onFormSubmit(value: Record<string, any>): Promise<void> {
    ui.showLoadingBar(true);
    console.log("Form submitted", value);
    this.mergeStarted = false;
    const parsed = v.safeParse(formSchema, value);
    if (!parsed.success) {
      toast.error("Invalid form data", {
        description: v.flatten(parsed.issues).root?.join(".") || "",
      });
      return;
    }
    const { url, resolutions } = parsed.output;

    // Reset progress tracking
    this.videoProgress = 0;
    this.audioProgress = 0;
    this.mergeProgress = 0;
    this.isDownloading = true;
    // ui.setProgressBar(0.0);
    ui.showLoadingBar(true);
    this.rpc?.api
      .downloadVideo(
        url,
        resolutions,
        () => {
          toast.info("Downloading, it will take a while...");
        },
        (progress) => {
          //   this.videoProgress = progress.downloaded / progress.total;
          //   console.log("this.videoProgress", this.videoProgress);
          //   this.updateTotalProgress();
          //   console.log("download video progress", progress);
        },
        (progress) => {
          console.log("audio progress", progress);
          //   this.audioProgress = progress.downloaded / progress.total;
          //   console.log("this.audioProgress", this.audioProgress);
          //   this.updateTotalProgress();
          //   console.log("download audio progress", progress);
        },
        (progress) => {
          console.log("merge progress", progress);
          if (!this.mergeStarted) {
            this.mergeStarted = true;
            toast.info("Start merging video and audio, please wait...");
          }
          // Extract time progress from timemark (format: HH:MM:SS.mm)
          //   const timeComponents = progress.timemark.split(/[:.]/);
          //   if (timeComponents.length >= 3) {
          //     const seconds =
          //       parseInt(timeComponents[0]) * 3600 +
          //       parseInt(timeComponents[1]) * 60 +
          //       parseInt(timeComponents[2]);
          //     // Merge takes up 50% of total progress
          //     this.mergeProgress = (seconds / 30) * 0.5; // Assuming 30 seconds total
          //     this.updateTotalProgress();
          //   }
          //   console.log("merge progress", progress);
        },
        () => {
          this.isDownloading = false;
          ui.showLoadingBar(false);
          toast.success("Finished Downloading!");
        }
      )
      .catch((err) => {
        ui.showLoadingBar(false);
        this.isDownloading = false;
        toast.error("Error downloading video", {
          description: err.message,
        });
      });
  }
  async load() {
    const ffmpegExists = await shell.hasCommand("ffmpeg");
    if (!ffmpegExists) {
      toast.error("ffmpeg not found", {
        description:
          "Kunkun has helper command for installing ffmpeg. Search for ffmpeg.",
      });
      return ui.goBack();
    }
    const hasText = await clipboard.hasText();
    if (!hasText) {
      toast.warning("No text found in clipboard");
      return ui.goBack();
    }
    let url = await clipboard.readText();
    url = "https://youtu.be/-b1FogYHTZc"; // for development only
    // check if url is a valid youtube url
    if (!url.includes("youtube.com") && !url.includes("youtu.be")) {
      toast.warning("Invalid YouTube URL from clipboard");
      return ui.goBack();
    }

    ui.render(
      new Markdown(`
# Download YouTube Video

Loading Information from YouTube URL: ${url}
`)
    );

    this.rpc = await getRpcAPI();
    const formats = await this.rpc.api.getAvailableResolutions(url);
    const form = new Form.Form({
      title: "Download YouTube Video",
      description: `Please copy a YouTube URL then enter this extension. 
      High Resolution video (e.g. 4K) could take a very long time to download, please be patient. 
      A progress bar with estimated time isn't implemented yet. There is a loading bar on the top.`,
      key: "download-youtube-video",
      showFormDataDebug: true,
      submitBtnText: "Download",
      fields: [
        new Form.InputField({
          key: "url",
          label: "URL",
          default: url,
        }),
        new Form.SelectField({
          key: "resolutions",
          label: "Resolutions",
          default: formats[0].qualityLabel,
          options: formats.map((format) => format.qualityLabel),
          description: "Select a resolution",
        }),
      ],
    });
    console.log(form);
    console.log(form.toModel());
    return ui.render(form);
  }

  async onBeforeGoBack(): Promise<void> {
    if (this.rpc) {
      await this.rpc.process.kill();
    }
  }

  async onActionSelected(actionValue: string): Promise<void> {
    switch (actionValue) {
      case "open":
        break;

      default:
        break;
    }
  }

  onSearchTermChange(term: string): Promise<void> {
    console.log("Search term changed to:", term);
    return Promise.resolve();
  }

  onListItemSelected(value: string): Promise<void> {
    console.log("Item selected:", value);
    return Promise.resolve();
  }
}

expose(new DownloadYouTubeExtension());
