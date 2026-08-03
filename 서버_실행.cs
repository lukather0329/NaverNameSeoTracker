using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Net.Sockets;
using System.Windows.Forms;

class ServerLauncher
{
    static readonly string RepoDir = @"C:\work\NaverNameSeoTracker";
    static readonly string EngineDir = @"C:\work\MontecarloEngine";
    static readonly string LogDir = RepoDir + @"\logs";

    [STAThread]
    static void Main()
    {
        Directory.CreateDirectory(LogDir);
        Trace("=== 서버 실행 시작 ===");

        List<string> started = new List<string>();
        List<string> skipped = new List<string>();
        List<string> failed = new List<string>();

        // 1) 몬테카를로 의사결정 엔진 (포트 8765)
        if (IsPortOpenAny(8765))
        {
            skipped.Add("몬테카를로 엔진 (8765) - 이미 실행 중");
        }
        else
        {
            string pythonExe = EngineDir + @"\.venv\Scripts\python.exe";
            if (!File.Exists(pythonExe))
            {
                failed.Add("몬테카를로 엔진 - python.exe를 찾을 수 없음: " + pythonExe);
            }
            else
            {
                string engineLog = LogDir + @"\engine.log";
                // 주의: pythonExe 경로를 따옴표로 감싸면 cmd.exe /c 파싱이 깨짐 (경로에 공백이 없어 불필요).
                string engineArgs = "/c " + pythonExe + " -m uvicorn rw_decision_engine.api.app:app --host 127.0.0.1 --port 8765 > \"" + engineLog + "\" 2>&1";
                if (RunHidden("cmd.exe", engineArgs, EngineDir))
                {
                    started.Add("몬테카를로 엔진 (8765)");
                }
                else
                {
                    failed.Add("몬테카를로 엔진 실행 실패 (로그: " + engineLog + ")");
                }
            }
        }

        // 2) 트래커 서버(4300) + 웹(5173) - 루트 package.json의 "dev" 스크립트가 concurrently로 둘 다 띄움
        bool p4300 = IsPortOpenAny(4300);
        bool p5173 = IsPortOpenAny(5173);
        Trace("port check 4300=" + p4300 + " 5173=" + p5173);
        if (p4300 && p5173)
        {
            skipped.Add("트래커 서버+웹 (4300 / 5173) - 이미 실행 중");
        }
        else
        {
            string trackerLog = LogDir + @"\tracker.log";
            string trackerArgs = "/c npm run dev > \"" + trackerLog + "\" 2>&1";
            if (RunHidden("cmd.exe", trackerArgs, RepoDir))
            {
                started.Add("트래커 서버+웹 (4300, 5173)");
            }
            else
            {
                failed.Add("트래커 서버+웹 실행 실패 (로그: " + trackerLog + ")");
            }
        }

        string message = "";
        if (started.Count > 0)
        {
            message += "시작함:\r\n - " + string.Join("\r\n - ", started.ToArray()) + "\r\n\r\n";
        }
        if (skipped.Count > 0)
        {
            message += "이미 실행 중이라 건너뜀:\r\n - " + string.Join("\r\n - ", skipped.ToArray()) + "\r\n\r\n";
        }
        if (failed.Count > 0)
        {
            message += "실패:\r\n - " + string.Join("\r\n - ", failed.ToArray()) + "\r\n\r\n";
        }
        message += "로그 위치: " + LogDir + "\r\n\r\n실제로 뜰 때까지 몇 초 걸릴 수 있습니다.\r\n엔진: http://127.0.0.1:8765/health\r\n웹: http://localhost:5173";

        Trace(message.Replace("\r\n", " | "));

        MessageBoxIcon icon = failed.Count > 0 ? MessageBoxIcon.Warning : MessageBoxIcon.Information;
        MessageBox.Show(message, "서버 실행", MessageBoxButtons.OK, icon);
    }

    static bool RunHidden(string fileName, string arguments, string workingDirectory)
    {
        try
        {
            ProcessStartInfo psi = new ProcessStartInfo();
            psi.FileName = fileName;
            psi.Arguments = arguments;
            psi.WorkingDirectory = workingDirectory;
            psi.UseShellExecute = false;
            psi.CreateNoWindow = true;
            psi.WindowStyle = ProcessWindowStyle.Hidden;
            Process.Start(psi);
            return true;
        }
        catch (Exception ex)
        {
            Trace("실행 실패: " + fileName + " " + arguments + " => " + ex.Message);
            return false;
        }
    }

    static void Trace(string line)
    {
        try
        {
            File.AppendAllText(LogDir + @"\launcher_trace.log", DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + " " + line + Environment.NewLine);
        }
        catch { }
    }

    static bool IsPortOpenAny(int port)
    {
        return IsPortOpen("127.0.0.1", port) || IsPortOpen("::1", port);
    }

    static bool IsPortOpen(string host, int port)
    {
        try
        {
            AddressFamily family = host.IndexOf(':') >= 0 ? AddressFamily.InterNetworkV6 : AddressFamily.InterNetwork;
            using (TcpClient client = new TcpClient(family))
            {
                IAsyncResult result = client.BeginConnect(host, port, null, null);
                bool success = result.AsyncWaitHandle.WaitOne(800);
                if (success && client.Connected)
                {
                    client.EndConnect(result);
                    return true;
                }
                return false;
            }
        }
        catch
        {
            return false;
        }
    }
}
