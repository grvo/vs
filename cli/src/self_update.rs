use std::{fs, path::Path};
use tempfile::tempdir;

use crate::{
    constans::{
        VS_CLI_COMMIT,
        VS_CLI_QUALITY
    },

    options::Quality,

    update_service::{
        unzip_donwloaded_release,

        Platform,
        Release,
        TargetKind,
        UpdateService
    },

    util::{
        command::new_std_command,

        errors::{
            wrap,

            AnyError,
            CodeError,
            CorruptDownload
        },

        http,

        io::{
            ReportCopyProgress,
            SilentCopyProgress
        }
    }
};

pub struct SelfUpdate<'a> {
    commit: &'static str,
    quality: Quality,
    platform: Platform,
    update_service: &'a UpdateService
}

static OLD_UPDATE_EXTENSION: &str = "atualizando cli";

impl<'a> SelfUpdate<'a> {
    pub fn new(update_service: &'a UpdateService) -> Result<Self, AnyError> {
        let commit = VS_CLI_COMMIT
            .ok_or_else(|| CodeError::UpdatesNotConfigured("commit de build desconhecido"))?;

        let quality = VS_CLI_QUALITY
            .ok_or_else(|| CodeError::UpdatesNotConfigured("qualidade não configurada"))

            .and_then(|q| {
                Quality::try_from(q).map_err(|_| CodeError::UpdatesNotConfigured("qualidade desconhecida"))
            })?;

        let platform = Platform::env_default().ok_or_else(|| {
            CodeError::UpdatesNotConfigured("plataforma desconhecida, por favor reportar esse erro")
        })?;

        Ok(Self {
            commit,
            quality,
            platform,
            update_service
        })
    }

    /// obtém o release atual
    pub async fn get_current_release(&self) -> Result<Release, AnyError> {
        self.update_service
            .get_latest_commit(self.platform, TargetKind::Cli, self.quality)
            .await
    }

    /// obtém aonde a release recebida quando o cli for construído em seguida
    pub fn is_up_to_date_with(&self, release: &Release) -> bool {
        release.commit == self.commit
    }

    /// limpa os binários antigos. deve ser chamado com regularidade.
    /// pode falhar se as versões antigas continuarem rodando.
    pub fn cleanup_old_update(&self) -> Result<(), std::io::Error> {
        let current_path = std::env::current_exe()?;
        let old_path = current_path.with_extension(OLD_UPDATE_EXTENSION);

        if old_path.exists() {
            fs::remove_file(old_path)?;
        }

        Ok(())
    }

    /// atualiza o cli para a release recebida
    pub async fn do_update(
        &self,

        release: &Release,
        progress: impl ReportCopyProgress
    ) -> Result<(), AnyError> {
        // 1. baixar o arquivo em um diretório temporário
        let tempdir = tempdir().map_err(|e| wrap(e, "falha ao criar diretório temporário"))?;
        let stream = self.update_service.get_download_stream(release).await?;
        let archive_path = tempdir.path().join(stream.url_path_basename().unwrap());

        http::download_into_file(&archive_path, progress, stream).await?;

        // 2. unzipar o arquivo e obter o binário
        let target_path = std::env::current_exe().map_err(|e| wrap(e, "pode não obter o exe atual"))?;
        let staging_path = target_path.with_extension(".update");
        let archive_contents_path = tempdir.path().join("content");

        unzip_donwloaded_release(&archive_path, &archive_contents_path, SilentCopyProgress())?;
        copy_updated_cli_to_path(&archive_contents_path, &staging_path)?;

        // 3. copiar metadata do arquivo, novo binário deve ser executável
        copy_file_metadata(&target_path, &staging_path)
            .map_err(|e| wrap(e, "falha ao determinar permissões do arquivo"))?;

        validate_cli_is_good(&staging_path)?;

        // tentar renomear o cli antigo para o tempdir, onde é limpo pelo
        // sistema operacional depois. isso pode falhar se o tempdir está em
        // um drive diferente do driver do dir de instalação.
        if fs::rename(&target_path, tempdir.path().join("old-code-cli")).is_err() {
            fs::rename(
                &target_path,

                target_path.with_extension(OLD_UPDATE_EXTENSION)
            )

            .map_err(|e| wrap(e, "falha ao renomear cli antigo"))?;
        }

        fs::rename(&staging_path, &target_path)
            .map_err(|e| wrap(e, "falha ao renomear o último cli instalado"))?;

        Ok(())
    }
}

fn validate_cli_is_good(exe_path: &Path) -> Result<(), AnyError> {
    let o = new_std_command(exe_path)
        .args(["--version"])
        .output()
        .map_err(|e| CorruptDownload(format!("não pode executar o novo binário, abortando: {}", e)))?;

    if !o.status.success() {
        let msg = format!(
            "não pode executar novo binário, abortando. stdout:\n\n{}\n\nstderr:\n\n{}",

            String::from_utf8_lossy(&o.stdout),
            String::from_utf8_lossy(&o.stderr)
        );

        return Err(CorruptDownload(msg).into());
    }

    Ok(())
}

fn copy_updated_cli_to_path(unzipped_content: &Path, staging_path: &Path) -> Result<(), AnyError> {
    let unzipped_files = fs::read_dir(unzipped_content)
        .map_err(|e| wrap(e, "não pode ler conteúdos atualizados"))?
        .collect::<Vec<_>>();

    if unzipped_files.len() != 1 {
        let msg = format!(
            "exatamente um arquivo esperado na atualização, obteve-se {}",

            unzipped_files.len()
        );

        return Err(CorruptDownload(msg).into());
    }

    let archive_file = unzipped_files[0]
        .as_ref()
        .map_err(|e| wrap(e, "erro enquanto arquivos de atualização for ouvido"))?;

    fs::copy(archive_file.path(), staging_path)
        .map_err(|e| wrap(e, "erro copiando o arquivo staging"))?;
        
    Ok(())
}

#[cfg(target_os = "windows")]
fn copy_file_metadata(from: &Path, to: &Path) -> Result<(), std::io::Error> {
    let permissions = from.metadata()?.permissions();

    fs::set_permissions(to, permissions)?;

    Ok(())
}

#[cfg(not(target_os = "windows"))]
fn copy_file_metadata(from: &Path, to: &Path) -> Result<(), std::io::Error> {
    use std::os::unix::ffi::OsStrExt;
    use std::os::unix::fs::MetadataExt;

    let metadata = from.metadata()?;

    fs::set_permissions(to, metadata.permissions())?;

    // baseado no coreutils - https://github.com/uutils/coreutils/blob/72b4629916abe0852ad27286f4e307fbca546b6e/src/chown/chown.rs#L266-L281
    let s = std::ffi::CString::new(to.as_os_str().as_bytes()).unwrap();

    let ret = unsafe {
        libc::chown(s.as_ptr(), metadata.uid(), metadata.gid())
    };

    if ret != 0 {
        return Err(std::io::Error::last_os_error());
    }

    Ok(())
}
