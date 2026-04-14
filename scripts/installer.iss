; Inno Setup Script for OpenClaude
; Generates a professional Windows installer

#define MyAppName "OpenClaude"
#define MyAppVersion "0.1.12"
#define MyAppPublisher "OpenClaude Contributors"
#define MyAppURL "https://gitlawb.com/z6MkqDnb7Siv3Cwj7pGJq4T5EsUisECqR8KpnDLwcaZq5TPr/openclaude"
#define MyAppExeName "openclaude.exe"

[Setup]
AppId={{B3E5F2A1-4C6D-4E8F-9A0B-1C2D3E4F5A6B}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\{#MyAppName}
DisableProgramGroupPage=yes
LicenseFile=..\LICENSE
InfoBeforeFile=..\README.md
OutputDir=..\dist
OutputBaseFilename=OpenClaude-v{#MyAppVersion}-Setup
Compression=lzma
SolidCompression=yes
WizardStyle=modern
PrivilegesRequiredOverridesAllowed=dialog

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "addtopath"; Description: "Add to PATH (requires restart)"; GroupDescription: "System integration"; Flags: unchecked; Check: IsAdminInstallMode

[Files]
Source: "..\dist\openclaude-launcher.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\dist\openclaude.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\README.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\LICENSE"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\openclaude-launcher.exe"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\openclaude-launcher.exe"; Tasks: desktopicon

[Registry]
; Add to PATH
Root: HKLM; Subkey: "SYSTEM\CurrentControlSet\Control\Session Manager\Environment"; ValueType: expandsz; ValueName: "Path"; ValueData: "{olddata};{app}"; Tasks: addtopath; Check: NeedsAddPath(ExpandConstant('{app}'))
; Add context menu for folders
Root: HKCR; Subkey: "Directory\shell\OpenClaude"; ValueType: string; ValueName: ""; ValueData: "Open folder with OpenClaude"; Flags: uninsdeletekey
Root: HKCR; Subkey: "Directory\shell\OpenClaude"; ValueType: string; ValueName: "Icon"; ValueData: "{app}\openclaude-launcher.exe,0"
Root: HKCR; Subkey: "Directory\shell\OpenClaude\command"; ValueType: string; ValueName: ""; ValueData: """{app}\openclaude-launcher.exe"" ""%V"""
; Add context menu for folders (skip permissions)
Root: HKCR; Subkey: "Directory\shell\OpenClaudeSkipPerms"; ValueType: string; ValueName: ""; ValueData: "Open folder with OpenClaude (Skip Permissions)"; Flags: uninsdeletekey
Root: HKCR; Subkey: "Directory\shell\OpenClaudeSkipPerms"; ValueType: string; ValueName: "Icon"; ValueData: "{app}\openclaude-launcher.exe,0"
Root: HKCR; Subkey: "Directory\shell\OpenClaudeSkipPerms\command"; ValueType: string; ValueName: ""; ValueData: """{app}\openclaude-launcher.exe"" --dangerously-skip-permissions ""%V"""
; Add context menu for folder background (right-click in empty space)
Root: HKCR; Subkey: "Directory\Background\shell\OpenClaude"; ValueType: string; ValueName: ""; ValueData: "Open folder with OpenClaude"; Flags: uninsdeletekey
Root: HKCR; Subkey: "Directory\Background\shell\OpenClaude"; ValueType: string; ValueName: "Icon"; ValueData: "{app}\openclaude-launcher.exe,0"
Root: HKCR; Subkey: "Directory\Background\shell\OpenClaude\command"; ValueType: string; ValueName: ""; ValueData: """{app}\openclaude-launcher.exe"" ""%V"""
; Add context menu for folder background (skip permissions)
Root: HKCR; Subkey: "Directory\Background\shell\OpenClaudeSkipPerms"; ValueType: string; ValueName: ""; ValueData: "Open folder with OpenClaude (Skip Permissions)"; Flags: uninsdeletekey
Root: HKCR; Subkey: "Directory\Background\shell\OpenClaudeSkipPerms"; ValueType: string; ValueName: "Icon"; ValueData: "{app}\openclaude-launcher.exe,0"
Root: HKCR; Subkey: "Directory\Background\shell\OpenClaudeSkipPerms\command"; ValueType: string; ValueName: ""; ValueData: """{app}\openclaude-launcher.exe"" --dangerously-skip-permissions ""%V"""

[Run]
Filename: "{app}\openclaude-launcher.exe"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent

[Code]
function NeedsAddPath(Param: string): boolean;
var
  OrigPath: string;
begin
  if not RegQueryStringValue(HKLM, 'SYSTEM\CurrentControlSet\Control\Session Manager\Environment', 'Path', OrigPath) then
  begin
    Result := true;
    exit;
  end;
  Result := Pos(';' + Param + ';', ';' + OrigPath + ';') = 0;
end;
