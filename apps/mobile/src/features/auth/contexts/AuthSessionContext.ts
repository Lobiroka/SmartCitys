import {createContext} from 'react';
import type {AuthSessionViewModel} from "@/src/features/auth/viewmodels/AuthSessionViewModel";

export const AuthSessionContext =
    createContext<
        AuthSessionViewModel|undefined
    >(undefined);