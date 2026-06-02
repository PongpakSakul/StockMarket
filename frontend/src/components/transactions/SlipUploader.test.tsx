import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import SlipUploader, {
  type SlipUploaderProps,
  type UploadResult,
  validateFiles,
} from './SlipUploader';

function createFile(
  name: string,
  size: number,
  type: string
): File {
  const content = new Uint8Array(size);
  return new File([content], name, { type });
}

function renderUploader(props: Partial<SlipUploaderProps> = {}) {
  const defaultProps: SlipUploaderProps = {
    onUploadComplete: vi.fn(),
    ...props,
  };
  return {
    ...render(<SlipUploader {...defaultProps} />),
    onUploadComplete: defaultProps.onUploadComplete as ReturnType<typeof vi.fn>,
  };
}

describe('SlipUploader', () => {
  describe('rendering', () => {
    it('renders the drop zone', () => {
      renderUploader();
      expect(screen.getByTestId('drop-zone')).toBeInTheDocument();
    });

    it('renders drag & drop instructions', () => {
      renderUploader();
      expect(screen.getByText(/Drag & drop/)).toBeInTheDocument();
      expect(screen.getByText(/slip images here/)).toBeInTheDocument();
    });

    it('renders browse files button', () => {
      renderUploader();
      expect(screen.getByRole('button', { name: 'Browse files' })).toBeInTheDocument();
    });

    it('renders file constraints info', () => {
      renderUploader();
      expect(screen.getByText(/JPG or PNG, up to 10MB each, max 20 files/)).toBeInTheDocument();
    });

    it('renders hidden file input with correct accept attribute', () => {
      renderUploader();
      const input = screen.getByTestId('file-input');
      expect(input).toHaveAttribute('accept', '.jpg,.jpeg,.png');
      expect(input).toHaveAttribute('multiple');
    });
  });

  describe('drag and drop', () => {
    it('highlights drop zone on drag over', () => {
      renderUploader();
      const dropZone = screen.getByTestId('drop-zone');

      fireEvent.dragOver(dropZone);

      expect(dropZone).toHaveClass('border-blue-500');
      expect(dropZone).toHaveClass('bg-blue-50');
    });

    it('removes highlight on drag leave', () => {
      renderUploader();
      const dropZone = screen.getByTestId('drop-zone');

      fireEvent.dragOver(dropZone);
      fireEvent.dragLeave(dropZone);

      expect(dropZone).not.toHaveClass('border-blue-500');
      expect(dropZone).not.toHaveClass('bg-blue-50');
    });

    it('calls onUploadComplete with valid files on drop', () => {
      const { onUploadComplete } = renderUploader();
      const dropZone = screen.getByTestId('drop-zone');

      const file = createFile('slip.jpg', 1024, 'image/jpeg');
      const dataTransfer = {
        files: [file],
      };

      fireEvent.drop(dropZone, { dataTransfer });

      expect(onUploadComplete).toHaveBeenCalledWith([
        { file, success: true },
      ]);
    });

    it('removes highlight after drop', () => {
      renderUploader();
      const dropZone = screen.getByTestId('drop-zone');

      fireEvent.dragOver(dropZone);
      const file = createFile('slip.jpg', 1024, 'image/jpeg');
      fireEvent.drop(dropZone, { dataTransfer: { files: [file] } });

      expect(dropZone).not.toHaveClass('border-blue-500');
    });
  });

  describe('file picker', () => {
    it('opens file picker when browse button is clicked', () => {
      renderUploader();
      const input = screen.getByTestId('file-input') as HTMLInputElement;
      const clickSpy = vi.spyOn(input, 'click');

      fireEvent.click(screen.getByRole('button', { name: 'Browse files' }));

      expect(clickSpy).toHaveBeenCalled();
    });

    it('calls onUploadComplete when files are selected via picker', () => {
      const { onUploadComplete } = renderUploader();
      const input = screen.getByTestId('file-input');

      const file = createFile('slip.png', 2048, 'image/png');
      fireEvent.change(input, { target: { files: [file] } });

      expect(onUploadComplete).toHaveBeenCalledWith([
        { file, success: true },
      ]);
    });
  });

  describe('file validation', () => {
    it('shows error for unsupported file type', () => {
      renderUploader();
      const dropZone = screen.getByTestId('drop-zone');

      const file = createFile('document.pdf', 1024, 'application/pdf');
      fireEvent.drop(dropZone, { dataTransfer: { files: [file] } });

      expect(screen.getByText(/Only JPG and PNG files are supported/)).toBeInTheDocument();
    });

    it('shows error for file exceeding 10MB', () => {
      renderUploader();
      const dropZone = screen.getByTestId('drop-zone');

      const file = createFile('large.jpg', 11 * 1024 * 1024, 'image/jpeg');
      fireEvent.drop(dropZone, { dataTransfer: { files: [file] } });

      expect(screen.getByText(/File exceeds 10MB size limit/)).toBeInTheDocument();
    });

    it('shows error when more than 20 files are dropped', () => {
      renderUploader();
      const dropZone = screen.getByTestId('drop-zone');

      const files: File[] = [];
      for (let i = 0; i < 21; i++) {
        files.push(createFile(`slip${i}.jpg`, 1024, 'image/jpeg'));
      }

      fireEvent.drop(dropZone, { dataTransfer: { files } });

      expect(screen.getByText(/Maximum 20 files allowed per batch/)).toBeInTheDocument();
    });

    it('does not call onUploadComplete when all files are invalid', () => {
      const { onUploadComplete } = renderUploader();
      const dropZone = screen.getByTestId('drop-zone');

      const file = createFile('doc.pdf', 1024, 'application/pdf');
      fireEvent.drop(dropZone, { dataTransfer: { files: [file] } });

      expect(onUploadComplete).not.toHaveBeenCalled();
    });

    it('calls onUploadComplete with only valid files when mix of valid/invalid', () => {
      const { onUploadComplete } = renderUploader();
      const dropZone = screen.getByTestId('drop-zone');

      const validFile = createFile('slip.jpg', 1024, 'image/jpeg');
      const invalidFile = createFile('doc.pdf', 1024, 'application/pdf');

      fireEvent.drop(dropZone, { dataTransfer: { files: [validFile, invalidFile] } });

      expect(onUploadComplete).toHaveBeenCalledWith([
        { file: validFile, success: true },
      ]);
      expect(screen.getByText(/Only JPG and PNG files are supported/)).toBeInTheDocument();
    });

    it('shows file name in error message', () => {
      renderUploader();
      const dropZone = screen.getByTestId('drop-zone');

      const file = createFile('badfile.gif', 1024, 'image/gif');
      fireEvent.drop(dropZone, { dataTransfer: { files: [file] } });

      expect(screen.getByText(/badfile.gif/)).toBeInTheDocument();
    });
  });

  describe('progress bar', () => {
    it('does not show progress bar when not uploading', () => {
      renderUploader({ uploading: false });
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });

    it('shows progress bar when uploading with progress', () => {
      renderUploader({
        uploading: true,
        progress: { processed: 3, total: 10 },
      });

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('displays processed/total count', () => {
      renderUploader({
        uploading: true,
        progress: { processed: 5, total: 10 },
      });

      expect(screen.getByText('5 / 10')).toBeInTheDocument();
    });

    it('sets correct progress bar width', () => {
      renderUploader({
        uploading: true,
        progress: { processed: 3, total: 10 },
      });

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveStyle({ width: '30%' });
    });

    it('sets correct aria attributes on progress bar', () => {
      renderUploader({
        uploading: true,
        progress: { processed: 7, total: 10 },
      });

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '7');
      expect(progressBar).toHaveAttribute('aria-valuemin', '0');
      expect(progressBar).toHaveAttribute('aria-valuemax', '10');
    });

    it('disables drop zone while uploading', () => {
      renderUploader({ uploading: true, progress: { processed: 1, total: 5 } });
      const dropZone = screen.getByTestId('drop-zone');
      expect(dropZone).toHaveAttribute('aria-disabled', 'true');
    });
  });

  describe('validateFiles utility', () => {
    it('accepts valid JPG file', () => {
      const file = createFile('test.jpg', 1024, 'image/jpeg');
      const { valid, errors } = validateFiles([file]);
      expect(valid).toHaveLength(1);
      expect(errors).toHaveLength(0);
    });

    it('accepts valid PNG file', () => {
      const file = createFile('test.png', 1024, 'image/png');
      const { valid, errors } = validateFiles([file]);
      expect(valid).toHaveLength(1);
      expect(errors).toHaveLength(0);
    });

    it('rejects non-image file', () => {
      const file = createFile('test.pdf', 1024, 'application/pdf');
      const { valid, errors } = validateFiles([file]);
      expect(valid).toHaveLength(0);
      expect(errors).toHaveLength(1);
      expect(errors[0].reason).toContain('JPG and PNG');
    });

    it('rejects file over 10MB', () => {
      const file = createFile('big.jpg', 11 * 1024 * 1024, 'image/jpeg');
      const { valid, errors } = validateFiles([file]);
      expect(valid).toHaveLength(0);
      expect(errors).toHaveLength(1);
      expect(errors[0].reason).toContain('10MB');
    });

    it('rejects batch over 20 files', () => {
      const files = Array.from({ length: 21 }, (_, i) =>
        createFile(`file${i}.jpg`, 1024, 'image/jpeg')
      );
      const { valid, errors } = validateFiles(files);
      expect(valid).toHaveLength(0);
      expect(errors).toHaveLength(1);
      expect(errors[0].reason).toContain('20');
    });

    it('accepts exactly 20 files', () => {
      const files = Array.from({ length: 20 }, (_, i) =>
        createFile(`file${i}.jpg`, 1024, 'image/jpeg')
      );
      const { valid, errors } = validateFiles(files);
      expect(valid).toHaveLength(20);
      expect(errors).toHaveLength(0);
    });

    it('accepts file exactly at 10MB', () => {
      const file = createFile('exact.jpg', 10 * 1024 * 1024, 'image/jpeg');
      const { valid, errors } = validateFiles([file]);
      expect(valid).toHaveLength(1);
      expect(errors).toHaveLength(0);
    });

    it('separates valid and invalid files in mixed batch', () => {
      const validFile = createFile('good.jpg', 1024, 'image/jpeg');
      const invalidFile = createFile('bad.txt', 1024, 'text/plain');
      const { valid, errors } = validateFiles([validFile, invalidFile]);
      expect(valid).toHaveLength(1);
      expect(valid[0].name).toBe('good.jpg');
      expect(errors).toHaveLength(1);
      expect(errors[0].fileName).toBe('bad.txt');
    });
  });

  describe('accessibility', () => {
    it('has accessible label on the uploader container', () => {
      renderUploader();
      expect(screen.getByLabelText('Slip uploader')).toBeInTheDocument();
    });

    it('drop zone is keyboard accessible', () => {
      renderUploader();
      const dropZone = screen.getByTestId('drop-zone');
      expect(dropZone).toHaveAttribute('tabIndex', '0');
      expect(dropZone).toHaveAttribute('role', 'button');
    });

    it('error section has alert role', () => {
      renderUploader();
      const dropZone = screen.getByTestId('drop-zone');

      const file = createFile('bad.pdf', 1024, 'application/pdf');
      fireEvent.drop(dropZone, { dataTransfer: { files: [file] } });

      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('progress section has status role', () => {
      renderUploader({
        uploading: true,
        progress: { processed: 1, total: 5 },
      });
      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });
});
