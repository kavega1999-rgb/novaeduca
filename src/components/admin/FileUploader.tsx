import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Upload, File, X, FileText, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface FileUploaderProps {
  onUploadComplete: (url: string, pageCount?: number) => void;
  currentFileUrl?: string;
}

const FileUploader = ({ onUploadComplete, currentFileUrl }: FileUploaderProps) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isCountingPages, setIsCountingPages] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [fileName, setFileName] = useState("");
  const [detectedPages, setDetectedPages] = useState<number | null>(null);

  // Accept all file types
  const acceptedFileTypes = "*/*";

  const countPdfPages = async (file: File): Promise<number | null> => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return null;
    }

    try {
      setIsCountingPages(true);
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      const text = new TextDecoder('latin1').decode(bytes);
      
      // Method 1: Count /Type /Page occurrences (excluding /Type /Pages)
      const pageMatches = text.match(/\/Type\s*\/Page[^s]/g);
      if (pageMatches && pageMatches.length > 0) {
        return pageMatches.length;
      }
      
      // Method 2: Look for /Count in the Pages object
      const countMatch = text.match(/\/Count\s+(\d+)/);
      if (countMatch) {
        return parseInt(countMatch[1], 10);
      }
      
      return null;
    } catch (error) {
      console.error("Error counting PDF pages:", error);
      return null;
    } finally {
      setIsCountingPages(false);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size (2GB)
    const maxSize = 2 * 1024 * 1024 * 1024; // 2GB in bytes
    if (file.size > maxSize) {
      toast({
        title: "Archivo muy grande",
        description: "El archivo no debe superar los 2GB",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    setFileName(file.name);
    setUploadProgress(0);
    setDetectedPages(null);

    try {
      // Count PDF pages before upload
      const pageCount = await countPdfPages(file);
      if (pageCount) {
        setDetectedPages(pageCount);
      }

      const fileExt = file.name.split(".").pop();
      const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      const { data, error } = await supabase.storage
        .from("training-materials")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from("training-materials")
        .getPublicUrl(filePath);

      onUploadComplete(publicUrl, pageCount || undefined);

      toast({
        title: "Archivo subido",
        description: pageCount 
          ? `Material subido exitosamente (${pageCount} páginas detectadas)`
          : "El material de apoyo ha sido subido exitosamente",
      });
    } catch (error: any) {
      console.error("Error uploading file:", error);
      toast({
        title: "Error",
        description: error.message || "No se pudo subir el archivo",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleRemoveFile = () => {
    onUploadComplete("", undefined);
    setFileName("");
    setDetectedPages(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Input
          ref={fileInputRef}
          type="file"
          accept={acceptedFileTypes}
          onChange={handleFileSelect}
          disabled={isUploading}
          className="hidden"
          id="file-upload"
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          <Upload className="w-4 h-4 mr-2" />
          {isUploading ? "Subiendo..." : "Seleccionar archivo"}
        </Button>
        <span className="text-sm text-muted-foreground">
          PDF, Video MP4 y otros (Máx. 2GB)
        </span>
      </div>

      {(isUploading || isCountingPages) && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            {isCountingPages ? (
              <>
                <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
                <span className="text-sm text-muted-foreground">Detectando páginas del PDF...</span>
              </>
            ) : (
              <>
                <File className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{fileName}</span>
              </>
            )}
          </div>
          {!isCountingPages && <Progress value={uploadProgress} className="w-full" />}
        </div>
      )}

      {detectedPages && !isUploading && (
        <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
          <FileText className="w-4 h-4" />
          <span>{detectedPages} páginas detectadas automáticamente</span>
        </div>
      )}

      {currentFileUrl && !isUploading && (
        <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
          <File className="w-4 h-4 text-muted-foreground" />
          <a
            href={currentFileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline flex-1 truncate"
          >
            {currentFileUrl.split("/").pop()}
          </a>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleRemoveFile}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default FileUploader;
