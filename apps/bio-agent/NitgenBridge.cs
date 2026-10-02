using System;
using System.IO;
using System.Text;
using NITGEN.SDK.NBioBSP;

internal static class Program
{
  [STAThread]
  private static int Main(string[] args)
  {
    Console.OutputEncoding = Encoding.UTF8;
    var action = args.Length > 0 ? args[0].Trim().ToLowerInvariant() : "health";
    try
    {
      if (action == "health") return Health();
      if (action == "enroll") return Enroll();
      if (action == "verify") return Verify(args.Length > 1 ? args[1] : "");
      return Fail("Acao invalida.");
    }
    catch (DllNotFoundException)
    {
      return Fail("Instale o eNBSP 5.2: Impressao\\eNBioBSP_v5.2.0.6_Windows\\...\\eNBioBSP_v5.2.0.6.exe (SERIAL.txt na mesma pasta). Depois rode npm run bio-agent:build e npm run bio-agent.");
    }
    catch (BadImageFormatException)
    {
      return Fail("DLL do SDK com arquitetura errada. Instale o eNBSP 5.2 (gera NBioBSP.dll 32-bit) e rode npm run bio-agent:build.");
    }
    catch (Exception ex)
    {
      return Fail(ex.Message);
    }
  }

  private static int Health()
  {
    var api = new NBioAPI();
    uint ret = api.OpenDevice(NBioAPI.Type.DEVICE_ID.AUTO);
    try
    {
      if (ret != NBioAPI.Error.NONE)
      {
        return Fail("Leitor nao abriu (codigo " + ret + "). Confira o USB do HFDU06.");
      }
      Console.WriteLine("{\"ok\":true,\"api\":true,\"usb\":true,\"com\":true,\"device\":\"HFDU06R\"}");
      return 0;
    }
    finally
    {
      api.CloseDevice(NBioAPI.Type.DEVICE_ID.AUTO);
    }
  }

  private static int Enroll()
  {
    var api = new NBioAPI();
    api.OpenDevice(NBioAPI.Type.DEVICE_ID.AUTO);
    try
    {
      NBioAPI.Type.HFIR newFir;
      uint ret = api.Enroll(out newFir, null);
      if (ret != NBioAPI.Error.NONE || newFir == null)
      {
        return Fail("Cadastro da digital cancelado ou falhou. Encoste o dedo quando a janela abrir.");
      }
      NBioAPI.Type.FIR_TEXTENCODE text;
      api.GetTextFIRFromHandle(newFir, out text, true);
      if (text == null || string.IsNullOrWhiteSpace(text.TextFIR))
      {
        return Fail("Cadastro nao gerou template.");
      }
      Console.WriteLine("{\"ok\":true,\"fir\":\"" + JsonEscape(text.TextFIR) + "\"}");
      return 0;
    }
    finally
    {
      api.CloseDevice(NBioAPI.Type.DEVICE_ID.AUTO);
    }
  }

  private static int Verify(string firFile)
  {
    if (string.IsNullOrWhiteSpace(firFile) || !File.Exists(firFile))
    {
      return Fail("Template cadastrado ausente para conferencia 1:1.");
    }
    var stored = File.ReadAllText(firFile).Trim();
    if (stored.Length < 32)
    {
      return Fail("Template cadastrado vazio.");
    }

    var api = new NBioAPI();
    api.OpenDevice(NBioAPI.Type.DEVICE_ID.AUTO);
    try
    {
      NBioAPI.Type.HFIR captured;
      uint ret = api.Capture(out captured);
      if (ret != NBioAPI.Error.NONE || captured == null)
      {
        return Fail("Captura cancelada. O motorista precisa encostar o dedo no leitor.");
      }
      var storedFir = new NBioAPI.Type.FIR_TEXTENCODE { TextFIR = stored };
      var payload = new NBioAPI.Type.FIR_PAYLOAD();
      bool matched;
      api.VerifyMatch(captured, storedFir, out matched, payload);
      Console.WriteLine(matched ? "{\"ok\":true,\"matched\":true}" : "{\"ok\":true,\"matched\":false}");
      return 0;
    }
    finally
    {
      api.CloseDevice(NBioAPI.Type.DEVICE_ID.AUTO);
    }
  }

  private static int Fail(string error)
  {
    Console.WriteLine("{\"ok\":false,\"error\":\"" + JsonEscape(error) + "\"}");
    return 1;
  }

  private static string JsonEscape(string value)
  {
    return (value ?? "")
      .Replace("\\", "\\\\")
      .Replace("\"", "\\\"")
      .Replace("\r", "\\r")
      .Replace("\n", "\\n");
  }
}
