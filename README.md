<div align="center">

  <img src="assets/brand/app_logo_wordmark.png" alt="Nuvio Enhanced" width="300" />

  <h1>Nuvio Enhanced</h1>

  <p>
    A free, open-source media app for your TV.
    <br />
    Bring your own sources. Nuvio Enhanced turns them into a library with artwork, ratings, subtitles, and your place saved on every screen.
  </p>

[Original Nuvio project](https://github.com/NuvioMedia/NuvioTVSmart)

</div>

## Get Nuvio Enhanced

Nuvio Enhanced supports **Samsung Tizen TVs from 2018 onward (Tizen 4+)** and **LG webOS TVs from 2020 onward (webOS 5+)**.
The startup compatibility baseline is Samsung Tizen 4.0 / Chromium 56 and LG webOS 5.0 / Chromium 68 when the platform reports those versions.

Platform capabilities are intentionally version-dependent:

- **Samsung Tizen 4.x** — the app and direct playback are supported, but torrent/P2P playback is unavailable by design. Some advanced audio and subtitle features may also be limited.
- **Samsung Tizen 5.x, including 5.5** — torrent/P2P playback is supported through the bundled local EngineFS service only. The PluginService, plugin execution, and remote plugin pull/push synchronization are disabled; the Plugins screen is not available.
  The Node 4.4.3 service runtime observed on Tizen 5.5 is incompatible with the current PluginService syntax and URL APIs. Experimental legacy transports are not included; plugin support starts at Tizen 6.0.
- **Samsung Tizen 6+** — torrent/P2P and the packaged PluginService are supported. Plugin execution requires the packaged service plus the TV runtime's Worker and WebAssembly support. Tizen 6 and later use the same current Tizen service pipeline.
- **LG webOS 5.x** — torrent/P2P and the packaged plugin service are supported, with the limited plugin resource quotas used by the older webOS runtime.
- **LG webOS 6+** — torrent/P2P and the packaged plugin service are supported with the modern plugin resource quotas.

On Tizen 5+ and LG webOS, torrent/P2P uses only the bundled local companion service; no external torrent streaming server is configured or required.

### LG webOS: Homebrew Channel

In Homebrew Channel, open **Settings → Add repository** and enter:

`https://raw.githubusercontent.com/alenkpedro/NuvioWeb-Enhanced/main/webosbrew/apps.json`

Then select **Nuvio Enhanced** from the app list to install it. The repository points to the Nuvio Enhanced IPK included in this fork.

Build a Nuvio Enhanced WGT or IPK from this checkout using the commands below. The original project's published packages contain Nuvio TV, not Nuvio Enhanced.

## Build from source

```bash
cd "Nuvio Enhanced"
npm install
npm run build
```

Build TV packages with:

```bash
npm run package:tizen
npm run package:tizen:store
npm run package:webos
```

## Test in the webOS TV Simulator

Run `npm run simulator:webos`, then select the [webos-simulator/app](./webos-simulator/app) folder in the Simulator's **File > Launch App** dialog (or its **App** button). Select that folder rather than the repository root: the source root has `appinfo.json` but does not contain the generated bundles or root-level icon files. The simulator opens the app directory containing `appinfo.json` and its assets.

For companion services, use **File > Add Service** with the `webos-simulator/companion-service` and `webos-simulator/plugin-service` folders after preparing the simulator build. Then check **Tools > Service List** and make sure both services are enabled. The companion service provides embedded subtitle and audio track discovery in the Simulator. The folder names avoid macOS treating `.service` as a package in the file picker.

`package:tizen` creates an unsigned WGT. `package:tizen:store` is a separate Seller Office build: it requires Tizen Studio/Web CLI and a configured security profile, and creates the signed Store package with the local EngineFS service included so Tizen 5+ retains torrent/P2P playback. Tizen 4 still reports P2P as unsupported at runtime. Nuvio Enhanced is built with JavaScript, HTML, CSS, and platform TV APIs. Building requires Node.js and npm; package installation additionally requires the relevant Tizen or webOS tools.

Update checks are off until `NUVIO_ENHANCED_RELEASE_REPO=owner/repository` is set in `local.properties` and the app is rebuilt. This prevents Nuvio Enhanced from offering the original project's releases as updates.

The Tizen widget URI uses the reserved `nuvio-enhanced.example` domain for development. Set a project-owned URI before submitting a Store build.

## License

[GNU General Public License v3.0](./LICENSE)

Nuvio Enhanced is based on [NuvioTVSmart by Nuvio Media](https://github.com/NuvioMedia/NuvioTVSmart). Original contributors and license terms are retained.

Nuvio Enhanced fork by **@pdr.alnk**.
