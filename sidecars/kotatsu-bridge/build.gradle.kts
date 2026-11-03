import com.github.jengelman.gradle.plugins.shadow.tasks.ShadowJar

plugins {
    kotlin("jvm") version "2.2.10"
    id("com.gradleup.shadow") version "8.3.8"
}

group = "com.fyodor"
version = "0.1.0"

tasks.withType<Jar> {
    manifest {
        attributes["Main-Class"] = "org.koitharu.kotatsu.dl.BridgeKt"
    }
}

tasks.withType<ShadowJar> {
    archiveBaseName.set("kotatsu-bridge")
    archiveClassifier.set("")
    archiveVersion.set("")
    // Do not minimize — parsers are loaded reflectively.
}

repositories {
    mavenLocal()
    mavenCentral()
    google()
    maven { setUrl("https://jitpack.io") }
}

dependencies {
    testImplementation(kotlin("test"))
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core-jvm:1.10.2")
    implementation("com.github.ajalt.clikt:clikt-core:5.0.3")
    // Kotatsu-Redo parsers (GPL-3.0) published via `sidecars/kotatsu-parsers-redo` → mavenLocal
    implementation("org.koitharu:kotatsu-parsers:1.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.squareup.okio:okio:3.11.0")
    implementation("org.openjdk.nashorn:nashorn-core:15.6")
    implementation("org.json:json:20240303")
    implementation("me.tongfei:progressbar:0.10.1")
    implementation("androidx.collection:collection:1.5.0")
}

tasks.test {
    useJUnitPlatform()
}

kotlin {
    jvmToolchain(17)
}
