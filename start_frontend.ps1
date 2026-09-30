$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$bunCommand = Get-Command bun -ErrorAction SilentlyContinue
if ($bunCommand) {
    $bunPath = $bunCommand.Source
}
else {
    $localBunPath = Join-Path $env:USERPROFILE ".bun\bin\bun.exe"
    if (Test-Path -LiteralPath $localBunPath) {
        $bunPath = $localBunPath
    }
}

if (-not $bunPath) {
    throw "Bun was not found. Install Bun or place bun.exe at $env:USERPROFILE\.bun\bin\bun.exe."
}

if (-not (Test-Path -LiteralPath "frontend\node_modules")) {
    & $bunPath install --cwd frontend
}

& $bunPath run --cwd frontend dev
exit $LASTEXITCODE
