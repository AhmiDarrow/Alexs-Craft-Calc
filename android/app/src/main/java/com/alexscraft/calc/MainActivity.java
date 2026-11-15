package com.alexscraft.calc;

import android.content.pm.PackageInfo;
import android.os.Build;
import android.webkit.JavascriptInterface;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void load() {
        super.load();
        if (bridge != null && bridge.getWebView() != null) {
            bridge.getWebView().addJavascriptInterface(new VersionBridge(), "AlexCraftApp");
        }
    }

    /** Lets the About screen read the installed APK versionName. */
    private final class VersionBridge {
        @JavascriptInterface
        public String getVersionName() {
            try {
                PackageInfo info = packageInfo();
                return info.versionName == null ? "" : info.versionName;
            } catch (Exception ex) {
                return "";
            }
        }

        @SuppressWarnings("deprecation")
        private PackageInfo packageInfo() throws Exception {
            if (Build.VERSION.SDK_INT >= 33) {
                return getPackageManager().getPackageInfo(
                    getPackageName(),
                    android.content.pm.PackageManager.PackageInfoFlags.of(0)
                );
            }
            return getPackageManager().getPackageInfo(getPackageName(), 0);
        }
    }
}
