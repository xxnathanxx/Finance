#define MyAppName "Órbita"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Órbita"
#define MyAppExeName "OrbitaDesktop.exe"

[Setup]
AppId={{B41C0454-BA76-4C10-878A-516F9DB2633A}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\Orbita
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
DisableDirPage=no
PrivilegesRequired=lowest
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir=output
OutputBaseFilename=OrbitaSetup
Compression=lzma
SolidCompression=yes
WizardStyle=modern
SetupIconFile=..\backend\assets\icone.ico
UninstallDisplayIcon={app}\{#MyAppExeName}

[Languages]
Name: "brazilianportuguese"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
Source: "..\backend\dist\{#MyAppExeName}"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\Desinstalar {#MyAppName}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#MyAppName}}"; Flags: nowait postinstall skipifsilent

[Code]
function GetUninstallString(): String;
var
  sUnInstPath: String;
  sUnInstallString: String;
begin
  sUnInstPath := 'Software\Microsoft\Windows\CurrentVersion\Uninstall\{#SetupSetting("AppId")}_is1';
  sUnInstallString := '';
  if not RegQueryStringValue(HKCU, sUnInstPath, 'UninstallString', sUnInstallString) then
    RegQueryStringValue(HKLM, sUnInstPath, 'UninstallString', sUnInstallString);
  Result := sUnInstallString;
end;

function IsJaInstalado(): Boolean;
begin
  Result := (GetUninstallString() <> '');
end;

procedure DesinstalarVersaoAnterior();
var
  sUnInstallString: String;
  iResultCode: Integer;
begin
  sUnInstallString := GetUninstallString();
  if sUnInstallString <> '' then
  begin
    sUnInstallString := RemoveQuotes(sUnInstallString);
    Exec(sUnInstallString, '/SILENT /NORESTART /SUPPRESSMSGBOXES', '', SW_SHOW, ewWaitUntilTerminated, iResultCode);
  end;
end;

function InitializeSetup(): Boolean;
var
  Escolha: Integer;
begin
  Result := True;
  if IsJaInstalado() then
  begin
    Escolha := MsgBox(
      'O Órbita já está instalado nesse computador.' + #13#10 + #13#10 +
      'Clique em "Sim" para remover a versão instalada antes de continuar (seus dados NÃO são apagados, ficam em %LOCALAPPDATA%\Orbita).' + #13#10 +
      'Clique em "Não" para reinstalar por cima da versão atual.' + #13#10 + #13#10 +
      'Cancelar fecha o instalador sem fazer nada.',
      mbConfirmation, MB_YESNOCANCEL
    );
    if Escolha = IDYES then
      DesinstalarVersaoAnterior()
    else if Escolha = IDCANCEL then
      Result := False;
  end;
end;
