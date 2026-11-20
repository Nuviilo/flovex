import java.io.File

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.flovex.app"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.flovex.app"
        minSdk = 24
        targetSdk = 34
        versionCode = 1
        versionName = "1.0.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.activity:activity-ktx:1.9.2")
    implementation("androidx.webkit:webkit:1.11.0")
}

val webRootDir = rootProject.projectDir.parentFile
val webDistDir = File(webRootDir, "dist")
val androidAssetsWwwDir = File(projectDir, "src/main/assets/www")

val installWebDependencies by tasks.registering(Exec::class) {
    group = "flovex"
    description = "Install npm dependencies in the root web project"
    workingDir = webRootDir
    val isWindows = System.getProperty("os.name").lowercase().contains("win")
    if (isWindows) {
        commandLine("cmd", "/c", "npm", "install")
    } else {
        commandLine("sh", "-c", "npm install")
    }
}

val buildWebBundle by tasks.registering(Exec::class) {
    group = "flovex"
    description = "Build the Vite web application into dist/"
    dependsOn(installWebDependencies)
    workingDir = webRootDir
    val isWindows = System.getProperty("os.name").lowercase().contains("win")
    if (isWindows) {
        commandLine("cmd", "/c", "npx", "vite", "build", "--base=./")
    } else {
        commandLine("sh", "-c", "npx vite build --base=./")
    }
}

val syncWebAssets by tasks.registering(Copy::class) {
    group = "flovex"
    description = "Copy built Vite web assets into Android assets/www"
    dependsOn(buildWebBundle)
    doFirst {
        if (androidAssetsWwwDir.exists()) {
            androidAssetsWwwDir.deleteRecursively()
        }
    }
    from(webDistDir)
    into(androidAssetsWwwDir)
}

tasks.named("preBuild") {
    dependsOn(syncWebAssets)
}
