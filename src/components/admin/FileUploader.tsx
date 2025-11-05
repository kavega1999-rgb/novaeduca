import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Upload, File, X } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface FileUploaderProps {
  onUploadComplete: (url: string) => void;
  currentFileUrl?: string;
}

const FileUploader = ({ onUploadComplete, currentFileUrl }: FileUploaderProps) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [fileName, setFileName] = useState("");

  const acceptedFileTypes = [
    "application/pdf",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "video/mp4",
    "video/mpeg",
    "video/quicktime",
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
  ].join(",");

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size (50MB)
    if (file.size > 52428800) {
      toast({
        title: "Archivo muy grande",
        description: "El archivo no debe superar los 50MB",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    setFileName(file.name);
    setUploadProgress(0);

    try {
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

      onUploadComplete(publicUrl);

      toast({
        title: "Archivo subido",
        description: "El material de apoyo ha sido subido exitosamente",
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
    onUploadComplete("");
    setFileName("");
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
          PDF, PPT, DOC, Imágenes, Videos (Máx. 50MB)
        </span>
      </div>

      {isUploading && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <File className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{fileName}</span>
          </div>
          <Progress value={uploadProgress} className="w-full" />
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
