#!/bin/sh
set -eu

target_arch="${1:-${TARGETARCH:-}}"
if [ -z "$target_arch" ]; then
  target_arch="$(dpkg --print-architecture)"
fi

case "$target_arch" in
  amd64|x86_64)
    chrome_platform="linux64"
    ;;
  *)
    echo "Google Chrome for Testing does not publish a Linux build for TARGETARCH=${target_arch}." >&2
    echo "Build the image for linux/amd64 to use Chrome for Testing." >&2
    exit 1
    ;;
esac

install_dir="${CHROME_FOR_TESTING_INSTALL_DIR:-/opt/chrome-for-testing}"
chrome_version="${CHROME_FOR_TESTING_VERSION:-127.0.6533.88}"
storage_base_url="${CHROME_FOR_TESTING_STORAGE_BASE_URL:-https://storage.googleapis.com/chrome-for-testing-public}"
tmp_dir="$(mktemp -d)"

cleanup() {
  rm -rf "$tmp_dir"
}
trap cleanup EXIT

download_url="${storage_base_url}/${chrome_version}/${chrome_platform}/chrome-${chrome_platform}.zip"

mkdir -p "$install_dir"
rm -rf "$install_dir/chrome-linux64"
curl -fsSL "$download_url" -o "$tmp_dir/chrome-for-testing.zip"
unzip -q "$tmp_dir/chrome-for-testing.zip" -d "$install_dir"
ln -sf "$install_dir/chrome-linux64/chrome" /usr/local/bin/google-chrome-for-testing
/usr/local/bin/google-chrome-for-testing --version
