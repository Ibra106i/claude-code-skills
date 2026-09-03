# Sync project to remote machine using scp
# Configure these for your environment
$source = "C:\Users\me\project\"                          # Local project path
$dest = "user@192.168.1.100:~/project/"                   # Remote destination
$sshKey = "C:\Users\me\.ssh\id_ed25519"                  # SSH key path

# Create remote directory structure
ssh -i $sshKey -o StrictHostKeyChecking=no user@192.168.1.100 "mkdir -p ~/project/src ~/project/public"

# Copy essential files (excluding node_modules, .git, dist)
Write-Host "Syncing project files to remote..."
scp -i $sshKey -o StrictHostKeyChecking=no -r "$source\package.json" user@192.168.1.100:~/project/
scp -i $sshKey -o StrictHostKeyChecking=no -r "$source\vite.config.ts" user@192.168.1.100:~/project/
scp -i $sshKey -o StrictHostKeyChecking=no -r "$source\tsconfig.json" user@192.168.1.100:~/project/
scp -i $sshKey -o StrictHostKeyChecking=no -r "$source\src\*" user@192.168.1.100:~/project/src/
scp -i $sshKey -o StrictHostKeyChecking=no -r "$source\public\*" user@192.168.1.100:~/project/public/

Write-Host "Sync complete!"
