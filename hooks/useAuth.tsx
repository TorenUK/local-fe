import { User } from "firebase/auth";
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  getUserProfile,
  subscribeToAuthState,
  UserProfile,
} from "../services/auth";

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  isAuthenticated: boolean;
  isLoggedIn: boolean;
  setIsLoggedIn?: (value: boolean) => void;
  mockLogout?: () => void;
  mockLogin?: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  loading: true,
  isAuthenticated: false,
  isLoggedIn: false,
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Simulate a mock Firebase user object
  const mockUser = {
    uid: "pXLGUgBJ2HV6FMm6Fw9yYNjTyc52",
    email: "mockuser@example.com",
    displayName: "Mock User",
  } as unknown as User;

  const mockProfile: UserProfile = {
    uid: "pXLGUgBJ2HV6FMm6Fw9yYNjTyc52",
    name: "Mock User",
    email: "toren@toren.uk",
    createdAt: {
      seconds: Math.floor(Date.now() / 1000),
      nanoseconds: 0,
    } as unknown as import("firebase/firestore").Timestamp,
    photoUrl: "", // or a mock URL
    isAnonymous: false,
    trackedReports: [],
    createdReports: [],
    lastActive: {
      seconds: Math.floor(Date.now() / 1000),
      nanoseconds: 0,
    } as unknown as import("firebase/firestore").Timestamp,
  };

  const mockLogin = () => {
    setUser(mockUser);
    setUserProfile(mockProfile);
    setIsLoggedIn(true);
    setLoading(false);
  };

  const mockLogout = () => {
    setUser(null);
    setUserProfile(null);
    setIsLoggedIn(false);
  };

  useEffect(() => {
    const USE_MOCK_USER = false;

    if (USE_MOCK_USER) {
      setUser(mockUser);
      setUserProfile(mockProfile);
      setIsLoggedIn(true);
      setLoading(false);

     //prevent memory leaks
      return () => {};
    }

    
    const unsubscribe = subscribeToAuthState(async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        try {
          const profile = await getUserProfile(firebaseUser.uid);
          setUserProfile(profile);
        } catch (error) {
          console.error("Error fetching user profile:", error);
          setUserProfile(null);
        }
      } else {
        setUserProfile(null);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);



  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        loading,
        isAuthenticated: !!user,
        isLoggedIn,
        setIsLoggedIn,
        mockLogin,
        mockLogout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
