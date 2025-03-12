import { YouTubeDownloader } from "./lib.ts";

const downloader = new YouTubeDownloader();

async function main() {
  // Prompt for YouTube URL if not provided
  const url = prompt("Enter YouTube URL: ") || "";
  if (!url) {
    console.error("No URL provided!");
    return;
  }

  try {
    // Get and display available formats
    const formats = await downloader.getAvailableResolutions(url);
    console.log("\nAvailable resolutions:");
    formats.forEach((format, index) => {
      console.log(
        `${index + 1}. ${format.qualityLabel} (${format.fps}fps)${
          format.hasAudio ? " with audio" : ""
        }`
      );
    });

    // Prompt for quality selection
    const selection = prompt("\nSelect quality (enter number): ");
    if (!selection) {
      console.error("No selection made!");
      return;
    }

    const index = parseInt(selection) - 1;
    if (index < 0 || index >= formats.length) {
      console.error("Invalid selection!");
      return;
    }

    const selectedFormat = formats[index];

    // Prompt for output filename
    const outputFileName =
      prompt("Enter output filename (default: video.mp4): ") || "video.mp4";

    console.log(`\nDownloading ${selectedFormat.qualityLabel} video...`);
    await downloader.downloadVideo(url, selectedFormat.qualityLabel);
  } catch (error) {
    console.error("An error occurred:", error);
  }
}

// Run the interactive prompt
await main();

// Example usage:
// const videoUrl = "https://youtu.be/C9fjh8XSg4M";

// // First, get and display available resolutions
// getAvailableResolutions(videoUrl).then(formats => {
//   console.log("Available resolutions:");
//   formats.forEach((format, index) => {
//     console.log(`${index + 1}. ${format.qualityLabel} (${format.fps}fps)${format.hasAudio ? ' with audio' : ''}`);
//   });

//   console.log("\nTo download, call downloadVideo with your chosen quality, for example:");
//   console.log(`downloadVideo("${videoUrl}", "1080p", "output.mp4")`);
// });

// If you want to see available formats first, uncomment this:
// ytdl.getInfo("https://youtu.be/C9fjh8XSg4M").then(info => {
//   console.log('Available formats:');
//   info.formats.forEach(format => {
//     console.log(`Quality: ${format.qualityLabel}, Container: ${format.container}`);
//   });
// });

// Alternatively, to download a specific resolution (e.g., 1080p)
// ytdl("https://youtu.be/C9fjh8XSg4M", {
//   quality: "highestvideo",
//   filter: (format) => format.qualityLabel === "1080p"
// }).pipe(
//   fs.createWriteStream("video-1080p.mp4")
// );
