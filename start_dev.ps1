$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$python = Get-Command py -ErrorAction SilentlyContinue
if (-not $python) {
    $python = Get-Command python -ErrorAction SilentlyContinue
}
if (-not $python) {
    throw "Python is required. Install Python 3.11+ and run this command again."
}

$node = Get-Command node -ErrorAction SilentlyContinue
$npm = Get-Command npm -ErrorAction SilentlyContinue
$bun = Get-Command bun -ErrorAction SilentlyContinue
$frontendInstallCommand = $null
$localBunPath = Join-Path $env:USERPROFILE ".bun\bin\bun.exe"
if (-not $bun -and (Test-Path -LiteralPath $localBunPath)) {
    $bunPath = $localBunPath
}
elseif ($bun) {
    $bunPath = $bun.Source
}
if ($bunPath) {
    $frontendInstallCommand = $bunPath
}
elseif ($npm) {
    $frontendInstallCommand = $npm.Source
}
if ((-not $node -or -not $npm) -and -not $bunPath) {
    throw "Node.js/npm or Bun is required for the frontend. Install one runtime and run this command again."
}

if ([string]::IsNullOrWhiteSpace($env:SECRET_KEY)) {
    $secretBytes = New-Object byte[] 32
    $randomNumberGenerator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $randomNumberGenerator.GetBytes($secretBytes)
    }
    finally {
        $randomNumberGenerator.Dispose()
    }
    $env:SECRET_KEY = [Convert]::ToBase64String($secretBytes)
    Write-Host "[INFO] Generated an ephemeral development SECRET_KEY for this session."
}

if (-not (Test-Path ".venv\Scripts\python.exe")) {
    & $python.Source -m venv .venv
}

$venvPython = Join-Path $PSScriptRoot ".venv\Scripts\python.exe"
if (-not (Test-Path "requirements.txt")) {
    throw "requirements.txt was not found."
}

# Install only when the environment is missing the backend package. This is a
# user-level setup and avoids network work on every launch.
& $venvPython -c "import fastapi" 2>$null
if ($LASTEXITCODE -ne 0) {
    & $venvPython -m pip install -r requirements.txt
}

if (-not (Test-Path "frontend\node_modules")) {
    if ($bunPath) {
        & $bunPath install --cwd frontend
    }
    else {
        & $frontendInstallCommand install --prefix frontend
    }
}

& $venvPython run_servers.py
exit $LASTEXITCODE
