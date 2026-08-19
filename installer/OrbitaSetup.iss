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
// GUID fixo igual ao AppId acima - NÃO usar {#SetupSetting("AppId")} aqui: a
// macro do ISPP devolve o texto cru do .iss ("{{B41C..." com chave dobrada
// de escape), não o valor de fato usado no registro ("{B41C..."), e isso
// fazia a detecção abaixo nunca bater com a instalação existente.
const
  AppUninstallKeyPath = 'Software\Microsoft\Windows\CurrentVersion\Uninstall\{B41C0454-BA76-4C10-878A-516F9DB2633A}_is1';

function GetUninstallString(): String;
var
  sUnInstallString: String;
begin
  sUnInstallString := '';
  if not RegQueryStringValue(HKCU, AppUninstallKeyPath, 'UninstallString', sUnInstallString) then
    RegQueryStringValue(HKLM, AppUninstallKeyPath, 'UninstallString', sUnInstallString);
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

var
  PaginaEscolhaInstalacao: TInputOptionWizardPage;

procedure InitializeWizard();
begin
  PaginaEscolhaInstalacao := CreateInputOptionPage(wpWelcome,
    'Instalação existente encontrada',
    'O Órbita já está instalado nesse computador. O que você quer fazer?',
    '',
    True, False);
  PaginaEscolhaInstalacao.Add('Atualizar (substitui o programa pela versão nova, mantém seus dados)');
  PaginaEscolhaInstalacao.Add('Remover tudo e instalar do zero (seus dados NÃO são apagados, ficam em %LOCALAPPDATA%\Orbita)');
  PaginaEscolhaInstalacao.SelectedValueIndex := 0;
end;

function ShouldSkipPage(PageID: Integer): Boolean;
begin
  Result := False;
  if PageID = PaginaEscolhaInstalacao.ID then
    Result := not IsJaInstalado();
end;

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;
  if (CurPageID = PaginaEscolhaInstalacao.ID) and (PaginaEscolhaInstalacao.SelectedValueIndex = 1) then
    DesinstalarVersaoAnterior();
end;
