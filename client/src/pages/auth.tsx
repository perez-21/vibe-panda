import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { BookOpen, Users, Search, ArrowRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { SiGoogle } from "react-icons/si";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const registerSchema = z
  .object({
    username: z
      .string()
      .min(3, "Username must be at least 3 characters")
      .max(20),
    email: z.string().email("Please enter a valid email"),
    displayName: z
      .string()
      .min(2, "Display name must be at least 2 characters"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type LoginFormValues = z.infer<typeof loginSchema>;
type RegisterFormValues = z.infer<typeof registerSchema>;

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const { login, register } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: googleAuth } = useQuery<{ enabled: boolean }>({
    queryKey: ["/api/auth/google/enabled"],
    queryFn: async () => {
      const res = await fetch("/api/auth/google/enabled");
      return res.json();
    },
  });

  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const registerForm = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      email: "",
      displayName: "",
      password: "",
      confirmPassword: "",
    },
  });

  const handleLogin = async (values: LoginFormValues) => {
    setIsSubmitting(true);
    try {
      await login(values.email, values.password);
    } catch (e: any) {
      toast({
        title: "Login failed",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async (values: RegisterFormValues) => {
    setIsSubmitting(true);
    try {
      await register({
        username: values.username,
        email: values.email,
        displayName: values.displayName,
        password: values.password,
      });
    } catch (e: any) {
      toast({
        title: "Registration failed",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <span className="text-3xl font-bold tracking-tight">
                Notepanda
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {mode === "login"
                ? "Welcome back! Sign in to continue."
                : "Create an account to get started."}
            </p>
          </div>

          <div className="flex rounded-md border p-1 gap-1">
            <button
              data-testid="tab-login"
              onClick={() => setMode("login")}
              className={`flex-1 py-2 px-4 rounded-sm text-sm font-medium transition-colors ${
                mode === "login"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground"
              }`}
            >
              Sign In
            </button>
            <button
              data-testid="tab-register"
              onClick={() => setMode("register")}
              className={`flex-1 py-2 px-4 rounded-sm text-sm font-medium transition-colors ${
                mode === "register"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground"
              }`}
            >
              Sign Up
            </button>
          </div>

          {mode === "login" ? (
            <Form {...loginForm} key="login-form">
              <form
                onSubmit={loginForm.handleSubmit(handleLogin)}
                className="space-y-4"
              >
                <FormField
                  control={loginForm.control}
                  name="email"
                  key="login-email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          data-testid="input-login-email"
                          type="email"
                          placeholder="you@university.edu"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={loginForm.control}
                  name="password"
                  key="login-password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input
                          data-testid="input-login-password"
                          type="password"
                          placeholder="Your password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  data-testid="button-login"
                  type="submit"
                  className="w-full"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Signing in..." : "Sign In"}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </form>
              {googleAuth?.enabled && (
                <>
                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">
                        or
                      </span>
                    </div>
                  </div>
                  <Button
                    data-testid="button-google-login"
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      window.location.href = "/api/auth/google";
                    }}
                    type="button"
                  >
                    <SiGoogle className="w-4 h-4 mr-2" />
                    Sign in with Google
                  </Button>
                </>
              )}
            </Form>
          ) : (
            <Form {...registerForm} key="register-form">
              <form
                onSubmit={registerForm.handleSubmit(handleRegister)}
                className="space-y-4"
              >
                <FormItem>
                  <FormLabel>Display Name</FormLabel>
                  <FormControl>
                    <Input
                      data-testid="input-register-displayname"
                      type="text"
                      placeholder="Mary Johnson"
                      {...registerForm.register("displayName")}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <Input
                      data-testid="input-register-username"
                      type="text"
                      placeholder="maryjohnson"
                      {...registerForm.register("username")}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
                <FormField
                  control={registerForm.control}
                  name="email"
                  key="register-email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          data-testid="input-register-email"
                          type="email"
                          placeholder="you@university.edu"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={registerForm.control}
                  name="password"
                  key="register-password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input
                          data-testid="input-register-password"
                          type="password"
                          placeholder="At least 6 characters"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={registerForm.control}
                  name="confirmPassword"
                  key="register-confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm Password</FormLabel>
                      <FormControl>
                        <Input
                          data-testid="input-register-confirm"
                          type="password"
                          placeholder="Confirm your password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  data-testid="button-register"
                  type="submit"
                  className="w-full"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Creating account..." : "Create Account"}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </form>
              {googleAuth?.enabled && (
                <>
                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">
                        or
                      </span>
                    </div>
                  </div>
                  <Button
                    data-testid="button-google-register"
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      window.location.href = "/api/auth/google";
                    }}
                    type="button"
                  >
                    <SiGoogle className="w-4 h-4 mr-2" />
                    Sign up with Google
                  </Button>
                </>
              )}
            </Form>
          )}
        </div>
      </div>

      <div className="hidden lg:flex flex-1 bg-primary/5 items-center justify-center p-12">
        <div className="max-w-lg space-y-8">
          <h2 className="text-3xl font-bold tracking-tight">
            Your study materials, organized and shared.
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            Stop losing notes in WhatsApp groups. Notepanda gives students a
            single place to create, organize, and collaborate on study
            materials.
          </p>
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-md bg-primary/10">
                <BookOpen className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Rich Note Editor</h3>
                <p className="text-sm text-muted-foreground">
                  Create beautifully formatted notes with headings, lists, code
                  blocks, and more.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-md bg-primary/10">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Organize with Modules</h3>
                <p className="text-sm text-muted-foreground">
                  Group related notes into modules by subject, course, or topic.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-md bg-primary/10">
                <Search className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Discover & Save</h3>
                <p className="text-sm text-muted-foreground">
                  Browse public notes from the community and save them to your
                  collection.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
