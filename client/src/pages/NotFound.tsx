import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Home } from "lucide-react";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();

  const handleGoHome = () => {
    setLocation("/");
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#0B0B0B]">
      <Card className="w-full max-w-lg mx-4 shadow-lg border border-[#2A2A2A] bg-[#1A1A1A] backdrop-blur-sm">
        <CardContent className="pt-8 pb-8 text-center">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-[#B4D94A]/15 rounded-full animate-pulse" />
              <AlertCircle className="relative h-16 w-16 text-[#B4D94A]" />
            </div>
          </div>

          <h1 className="serif text-4xl font-bold text-[#F4F1EA] mb-2">404</h1>

          <h2 className="text-xl font-semibold text-[#F4F1EA]/80 mb-4">
            Page Not Found
          </h2>

          <p className="text-[#F4F1EA]/65 mb-8 leading-relaxed">
            Sorry, the page you are looking for doesn't exist.
            <br />
            It may have been moved or deleted.
          </p>

          <div
            id="not-found-button-group"
            className="flex flex-col sm:flex-row gap-3 justify-center"
          >
            <Button
              onClick={handleGoHome}
              className="bg-[#B4D94A] hover:bg-[#C6E86D] text-[#111111] px-6 py-2.5 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
            >
              <Home className="w-4 h-4 mr-2" />
              Go Home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
