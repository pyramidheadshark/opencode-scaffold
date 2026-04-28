# Cloud-Init Template for Docker Compose Auto-Start

This template is referenced in the Terraform VM module as `cloud-init.yaml`.
It automatically pulls the Docker image and starts the application when the VM boots.

```yaml
#cloud-config
write_files:
  - path: /home/ubuntu/docker-compose.yml
    encoding: b64
    content: ${docker_compose_content}
    permissions: '0644'

  - path: /home/ubuntu/.env
    encoding: b64
    content: ${env_content}
    permissions: '0600'

  - path: /etc/systemd/system/app.service
    content: |
      [Unit]
      Description=Application Docker Compose
      Requires=docker.service
      After=docker.service network-online.target

      [Service]
      Type=oneshot
      RemainAfterExit=yes
      WorkingDirectory=/home/ubuntu
      ExecStart=/usr/bin/docker compose up -d --pull always
      ExecStop=/usr/bin/docker compose down
      User=ubuntu

      [Install]
      WantedBy=multi-user.target

runcmd:
  - systemctl daemon-reload
  - systemctl enable app.service
  - systemctl start app.service
```

The `${docker_compose_content}` and `${env_content}` placeholders are filled by Terraform's `templatefile()` function before passing to the VM metadata.
