import ytdl from "@distube/ytdl-core";

export async function getVideoName(url: string): Promise<string> {
  try {
    const info = await ytdl.getInfo(url);
    return info.videoDetails.title;
  } catch (error) {
    throw new Error(`Failed to get video name: ${error.message}`);
  }
}

console.log(await getVideoName("https://youtu.be/jcYuaAP4jec"));
