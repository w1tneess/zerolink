import QRCode from "qrcode";

export async function generateQrSvg(text: string): Promise<string> {
  return QRCode.toString(text, {
    type: "svg",
    margin: 2,
    width: 220,
    errorCorrectionLevel: "M",
    color: {
      dark: "#09090b",
      light: "#ffffff",
    },
  });
}
